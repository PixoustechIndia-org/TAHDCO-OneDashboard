using BAL.Interface;
using BAL.Service;
using BAL.Service.ModuleAdapters;
using DAL;
using Microsoft.Extensions.Logging;
using Model.ViewModel;
using Moq;
using Xunit;

namespace API.Tests
{
    /// <summary>TEST 15-16 of 16 (spec section 36) — the MCP tool layer's own guardrails
    /// (spec section 14: "No arbitrary SQL, no arbitrary API URL execution", rate limiting).
    /// These must hold even when called directly (bypassing the LLM), since the LLM is not a
    /// trusted boundary — the tool service itself must refuse bad input.</summary>
    public class DashboardMcpToolServiceTests
    {
        private static DashboardMcpToolService BuildService(
            Mock<IModuleAdapterRegistry> adapters, Mock<ICountCacheService> countCache,
            Mock<IDetailCacheService> detailCache, Mock<IDetailCacheRepository> records) =>
            new DashboardMcpToolService(adapters.Object, countCache.Object, detailCache.Object, records.Object,
                Mock.Of<ILogger<DashboardMcpToolService>>());

        // TEST 15: an unknown module string must be rejected before the registry, count cache,
        // or detail cache are ever touched — "module" is the only caller-controlled routing
        // input, and it must be validated against DashboardModule.All up front (no code path
        // from an unvalidated string to a DB/HTTP call).
        [Fact]
        public async Task Test15_UnknownModule_RejectedBeforeAnyDownstreamCall()
        {
            var adapters = new Mock<IModuleAdapterRegistry>();
            var countCache = new Mock<ICountCacheService>();
            var detailCache = new Mock<IDetailCacheService>();
            var records = new Mock<IDetailCacheRepository>();
            var service = BuildService(adapters, countCache, detailCache, records);

            var result = await service.GetDashboardCountAsync("NOT_A_REAL_MODULE", null, userId: 900001);

            Assert.False(result.Success);
            Assert.Contains("Unknown module", result.Error);
            adapters.Verify(a => a.Get(It.IsAny<string>()), Times.Never);
            countCache.Verify(c => c.GetCountDataAsync(It.IsAny<IDashboardModuleAdapter>(), It.IsAny<Dictionary<string, object?>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // TEST 16: per-user rate limiting — once a user exceeds the tool's per-minute budget,
        // further calls fail cleanly with a rate-limit message instead of continuing to hit the
        // cache/DB layer for every LLM tool-call retry.
        [Fact]
        public async Task Test16_ExceedingPerMinuteBudget_RejectsFurtherCalls()
        {
            var adapter = new Mock<IDashboardModuleAdapter>();
            adapter.SetupGet(a => a.Module).Returns(DashboardModule.Telp);

            var adapters = new Mock<IModuleAdapterRegistry>();
            adapters.Setup(a => a.Get(DashboardModule.Telp)).Returns(adapter.Object);

            var countCache = new Mock<ICountCacheService>();
            countCache.Setup(c => c.GetCountDataAsync(It.IsAny<IDashboardModuleAdapter>(), It.IsAny<Dictionary<string, object?>>(), It.IsAny<CancellationToken>()))
                      .ReturnsAsync(new CacheResultDto<IReadOnlyList<NormalizedCountDto>> { Data = Array.Empty<NormalizedCountDto>(), Source = DataSource.Cache });

            var detailCache = new Mock<IDetailCacheService>();
            var records = new Mock<IDetailCacheRepository>();
            var service = BuildService(adapters, countCache, detailCache, records);

            // Unique per test run so this doesn't collide with the shared, process-static
            // rate-limit window if other tests happen to run against the same userId.
            var userId = 500000 + Environment.TickCount % 100000;

            var outcomes = new List<bool>();
            for (var i = 0; i < 35; i++)
            {
                var result = await service.GetDashboardCountAsync(DashboardModule.Telp, null, userId);
                outcomes.Add(result.Success);
            }

            Assert.Contains(true, outcomes);   // early calls within budget succeeded
            Assert.Contains(false, outcomes);  // later calls were rejected once the budget was exceeded
            Assert.True(outcomes.TakeLast(1).All(s => s == false), "the last call, well past any reasonable per-minute budget, must be rejected");
        }
    }
}
