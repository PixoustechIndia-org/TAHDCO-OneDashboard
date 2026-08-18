using BAL.Interface;
using BAL.Service;
using DAL;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Model.ViewModel;
using Moq;
using Xunit;

namespace API.Tests
{
    /// <summary>COUNT-side mirror of DetailCacheServiceTests (spec section 18) — TEST 11-12
    /// of the 16 scenarios in spec section 36. Confirms the COUNT cache follows the same
    /// fresh-hit / no-cache-failure contract as DETAIL, independently implemented but with
    /// identical guarantees.</summary>
    public class CountCacheServiceTests
    {
        private static CountCacheService BuildService(Mock<IDetailCacheRepository> repo) =>
            new CountCacheService(repo.Object, new SingleFlightRegistry(),
                Options.Create(new DataFreshnessPolicyOptions()),
                Mock.Of<ILogger<CountCacheService>>());

        private static Mock<IDashboardModuleAdapter> AdapterMock()
        {
            var adapter = new Mock<IDashboardModuleAdapter>();
            adapter.SetupGet(a => a.Module).Returns(DashboardModule.Thms);
            adapter.Setup(a => a.GetCountCacheKey(It.IsAny<Dictionary<string, object?>>())).Returns("THMS|COUNT|-");
            adapter.Setup(a => a.BuildCountRequest(It.IsAny<Dictionary<string, object?>>())).Returns(new { });
            return adapter;
        }

        // TEST 11: a fresh COUNT cache row is returned without ever calling the live adapter.
        [Fact]
        public async Task Test11_FreshCountCache_ReturnsCache_NeverCallsAdapter()
        {
            var counts = new List<NormalizedCountDto> { new() { Module = DashboardModule.Thms, District = "Salem", Metric = "completed", Value = 42 } };
            var row = new CacheRow
            {
                Status = CacheStatus.Fresh,
                NormalizedData = System.Text.Json.JsonSerializer.Serialize(counts),
                RecordCount = 1,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5)
            };

            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(row);

            var adapter = AdapterMock();
            var service = BuildService(repo);
            var result = await service.GetCountDataAsync(adapter.Object, new Dictionary<string, object?>());

            Assert.False(result.Unavailable);
            Assert.Equal(DataSource.Cache, result.Source);
            Assert.Single(result.Data!);
            adapter.Verify(a => a.GetCountDataAsync(It.IsAny<Dictionary<string, object?>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // TEST 12: no cache + a failing COUNT API never throws out of GetCountDataAsync — it
        // degrades to an honest Unavailable result, same contract as the DETAIL side.
        [Fact]
        public async Task Test12_NoCountCache_ApiFailure_ReturnsUnavailable_NeverThrows()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync((CacheRow?)null);
            repo.Setup(r => r.EnsurePlaceholderAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>())).ReturnsAsync(1L);

            var adapter = AdapterMock();
            adapter.Setup(a => a.GetCountDataAsync(It.IsAny<Dictionary<string, object?>>(), It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new ExternalApiException("Upstream API returned 500.", "boom", 500));

            var service = BuildService(repo);
            var result = await service.GetCountDataAsync(adapter.Object, new Dictionary<string, object?>());

            Assert.True(result.Unavailable);
            Assert.Empty(result.Data!);
            Assert.Equal(DataSource.None, result.Source);
            repo.Verify(r => r.MarkFailedAsync(It.IsAny<string>(), It.IsAny<DateTime>()), Times.Once);
        }
    }
}
