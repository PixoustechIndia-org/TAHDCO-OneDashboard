using BAL.Interface;
using BAL.Service;
using DAL;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Model.ViewModel;
using Moq;
using System.Text.Json;
using Xunit;

namespace API.Tests
{
    /// <summary>
    /// Covers the stale-while-revalidate + never-destroy-old-data algorithm in
    /// BAL/Service/DetailCacheService.cs (spec section 9). TEST 1-6 of the 16 scenarios in
    /// spec section 36. Uses the real SingleFlightRegistry (trivial, deterministic for these
    /// single-caller tests) and a mocked IDetailCacheRepository/IDashboardModuleAdapter so no
    /// database or network call ever happens.
    /// </summary>
    public class DetailCacheServiceTests
    {
        private static DetailCacheService BuildService(Mock<IDetailCacheRepository> repo) =>
            new DetailCacheService(repo.Object, new SingleFlightRegistry(),
                Options.Create(new DataFreshnessPolicyOptions()),
                Mock.Of<ILogger<DetailCacheService>>());

        private static ClickContextDto SampleContext() => new()
        {
            Module = DashboardModule.Telp,
            District = "Chennai",
            Division = "Chennai Division",
            Metric = "statusSavedCount"
        };

        private static Mock<IDashboardModuleAdapter> AdapterMock()
        {
            var adapter = new Mock<IDashboardModuleAdapter>();
            adapter.SetupGet(a => a.Module).Returns(DashboardModule.Telp);
            adapter.Setup(a => a.GetDetailCacheKey(It.IsAny<ClickContextDto>())).Returns("TELP|DETAIL|Chennai|statusSavedCount");
            adapter.Setup(a => a.BuildDetailRequest(It.IsAny<ClickContextDto>())).Returns(new { });
            return adapter;
        }

        // TEST 1: a FRESH, non-expired cache row is returned as-is and the live adapter is
        // never called — the whole point of caching is a zero-network-call fast path.
        [Fact]
        public async Task Test01_FreshCache_ReturnsCacheData_NeverCallsAdapter()
        {
            var records = new List<NormalizedDetailRecordDto> { new() { Module = DashboardModule.Telp, District = "Chennai", Metric = "statusSavedCount" } };
            var row = new CacheRow
            {
                Status = CacheStatus.Fresh,
                NormalizedData = JsonSerializer.Serialize(records),
                RecordCount = 1,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5),
                LastSuccessAt = DateTime.UtcNow.AddMinutes(-1)
            };

            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(row);

            var adapter = AdapterMock();
            var service = BuildService(repo);

            var result = await service.GetDetailDataAsync(adapter.Object, SampleContext());

            Assert.False(result.Stale);
            Assert.False(result.Unavailable);
            Assert.Equal(DataSource.Cache, result.Source);
            Assert.Single(result.Data!);
            adapter.Verify(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // TEST 2: a STALE row (expired TTL but real data present) is returned immediately —
        // never blocks the caller on the live API — with Stale=true so the UI must disclose it.
        [Fact]
        public async Task Test02_StaleCache_ReturnsCachedDataImmediately_MarkedStale()
        {
            var records = new List<NormalizedDetailRecordDto> { new() { Module = DashboardModule.Telp, District = "Chennai", Metric = "statusSavedCount" } };
            var row = new CacheRow
            {
                Status = CacheStatus.Stale,
                NormalizedData = JsonSerializer.Serialize(records),
                RecordCount = 1,
                ExpiresAt = DateTime.UtcNow.AddMinutes(-10), // expired
                LastSuccessAt = DateTime.UtcNow.AddHours(-2)
            };

            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(row);
            // background refresh will fire-and-forget; give it something harmless to do.
            var adapter = AdapterMock();
            adapter.Setup(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>())).ReturnsAsync("{}");
            adapter.Setup(a => a.NormalizeDetailResponse(It.IsAny<string>(), It.IsAny<ClickContextDto>())).Returns(records);

            var service = BuildService(repo);
            var result = await service.GetDetailDataAsync(adapter.Object, SampleContext());

            Assert.True(result.Stale);
            Assert.False(result.Unavailable);
            Assert.Equal(DataSource.Cache, result.Source);
            Assert.Single(result.Data!);
        }

        // TEST 3: no usable cache at all + a successful live call must store the result
        // (UpsertSuccessAsync + ReplaceDetailRecordsAsync) and return it marked fresh.
        [Fact]
        public async Task Test03_NoCache_ApiSuccess_StoresAndReturnsFreshData()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync((CacheRow?)null);
            repo.Setup(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>())).ReturnsAsync(42L);

            var records = new List<NormalizedDetailRecordDto> { new() { Module = DashboardModule.Telp, District = "Chennai", Metric = "statusSavedCount" } };
            var adapter = AdapterMock();
            adapter.Setup(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>())).ReturnsAsync("{\"rows\":[]}");
            adapter.Setup(a => a.NormalizeDetailResponse(It.IsAny<string>(), It.IsAny<ClickContextDto>())).Returns(records);

            var service = BuildService(repo);
            var result = await service.GetDetailDataAsync(adapter.Object, SampleContext());

            Assert.False(result.Unavailable);
            Assert.False(result.Stale);
            Assert.Equal(DataSource.Api, result.Source);
            Assert.Single(result.Data!);
            repo.Verify(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Once);
            repo.Verify(r => r.ReplaceDetailRecordsAsync(42L, DashboardModule.Telp, It.IsAny<IEnumerable<DetailRecordRow>>()), Times.Once);
        }

        // TEST 4: no usable cache AND the live call fails -> an honest "unavailable" result,
        // never an unhandled exception, and the repo is only ever told about the failure
        // (EnsurePlaceholderAsync + MarkFailedAsync) — UpsertSuccessAsync must never run.
        [Fact]
        public async Task Test04_NoCache_ApiFailure_ReturnsUnavailable_NeverThrows_NeverWritesSuccessData()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync((CacheRow?)null);
            repo.Setup(r => r.EnsurePlaceholderAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>())).ReturnsAsync(1L);

            var adapter = AdapterMock();
            adapter.Setup(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new ExternalApiException("Upstream API is unreachable.", "network error"));

            var service = BuildService(repo);
            var result = await service.GetDetailDataAsync(adapter.Object, SampleContext());

            Assert.True(result.Unavailable);
            Assert.Empty(result.Data!);
            Assert.Equal(DataSource.None, result.Source);
            Assert.False(string.IsNullOrWhiteSpace(result.Message));

            repo.Verify(r => r.MarkFailedAsync(It.IsAny<string>(), It.IsAny<DateTime>()), Times.Once);
            repo.Verify(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
        }

        // TEST 5: the manual "Refresh" action (RefreshDetailDataAsync), on success, stores the
        // new data exactly like an automatic background refresh would.
        [Fact]
        public async Task Test05_ManualRefresh_Success_StoresNewData()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>())).ReturnsAsync(7L);

            var adapter = AdapterMock();
            adapter.Setup(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>())).ReturnsAsync("{}");
            adapter.Setup(a => a.NormalizeDetailResponse(It.IsAny<string>(), It.IsAny<ClickContextDto>()))
                   .Returns(new List<NormalizedDetailRecordDto> { new() { Module = DashboardModule.Telp } });

            var service = BuildService(repo);
            var result = await service.RefreshDetailDataAsync(adapter.Object, SampleContext());

            Assert.True(result.Triggered);
            Assert.True(result.Success);
            repo.Verify(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Once);
        }

        // TEST 6: the manual "Refresh" action, on failure, must ONLY call MarkFailedAsync —
        // never UpsertSuccessAsync/ReplaceDetailRecordsAsync — proving a failed refresh can
        // never destroy previously-good data, and the caller is told plainly what happened.
        [Fact]
        public async Task Test06_ManualRefresh_Failure_NeverOverwritesOldData()
        {
            var repo = new Mock<IDetailCacheRepository>();

            var adapter = AdapterMock();
            adapter.Setup(a => a.GetDetailDataAsync(It.IsAny<ClickContextDto>(), It.IsAny<CancellationToken>()))
                   .ThrowsAsync(new ExternalApiException("Upstream API timed out.", "timeout", timeout: true));

            var service = BuildService(repo);
            var result = await service.RefreshDetailDataAsync(adapter.Object, SampleContext());

            Assert.True(result.Triggered);
            Assert.False(result.Success);
            Assert.Contains("kept", result.Message, StringComparison.OrdinalIgnoreCase);

            repo.Verify(r => r.MarkFailedAsync(It.IsAny<string>(), It.IsAny<DateTime>()), Times.Once);
            repo.Verify(r => r.UpsertSuccessAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<string>()), Times.Never);
            repo.Verify(r => r.ReplaceDetailRecordsAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<IEnumerable<DetailRecordRow>>()), Times.Never);
        }

        // TEST 7: no row at all for this clickContext -> Exists=false, RecordCount=0.
        [Fact]
        public async Task Test07_GetDataStatus_NoRow_ReturnsNotExists()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync((CacheRow?)null);

            var service = BuildService(repo);
            var status = await service.GetDataStatusAsync(AdapterMock().Object, SampleContext());

            Assert.False(status.Exists);
            Assert.False(status.Fresh);
            Assert.False(status.Stale);
            Assert.Equal(0, status.RecordCount);
        }

        // TEST 8: an unexpired FRESH row reports Fresh=true / Stale=false.
        [Fact]
        public async Task Test08_GetDataStatus_FreshRow_ReportsFresh()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(new CacheRow
            {
                Status = CacheStatus.Fresh,
                NormalizedData = "[]",
                RecordCount = 3,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5)
            });

            var service = BuildService(repo);
            var status = await service.GetDataStatusAsync(AdapterMock().Object, SampleContext());

            Assert.True(status.Exists);
            Assert.True(status.Fresh);
            Assert.False(status.Stale);
            Assert.Equal(3, status.RecordCount);
        }

        // TEST 9: an expired row (TTL elapsed) reports Fresh=false / Stale=true, even though
        // the stored status column might still literally say "FRESH" from its last write.
        [Fact]
        public async Task Test09_GetDataStatus_ExpiredRow_ReportsStale()
        {
            var repo = new Mock<IDetailCacheRepository>();
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(new CacheRow
            {
                Status = CacheStatus.Fresh,
                NormalizedData = "[]",
                RecordCount = 3,
                ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
            });

            var service = BuildService(repo);
            var status = await service.GetDataStatusAsync(AdapterMock().Object, SampleContext());

            Assert.True(status.Exists);
            Assert.False(status.Fresh);
            Assert.True(status.Stale);
        }

        // TEST 10: GetDataSourceAsync's three possible answers (spec: "the AI must be able to
        // disclose CACHE / STALE / NONE") map to the right underlying data status combination.
        [Theory]
        [InlineData(null, DataSource.None)]
        [InlineData("fresh", DataSource.Cache)]
        [InlineData("stale", "STALE")]
        public async Task Test10_GetDataSource_ReturnsExpectedLabel(string? rowState, string expected)
        {
            var repo = new Mock<IDetailCacheRepository>();
            CacheRow? row = rowState switch
            {
                "fresh" => new CacheRow { Status = CacheStatus.Fresh, NormalizedData = "[]", RecordCount = 1, ExpiresAt = DateTime.UtcNow.AddMinutes(5) },
                "stale" => new CacheRow { Status = CacheStatus.Stale, NormalizedData = "[]", RecordCount = 1, ExpiresAt = DateTime.UtcNow.AddMinutes(-5) },
                _ => null
            };
            repo.Setup(r => r.GetByCacheKeyAsync(It.IsAny<string>())).ReturnsAsync(row);

            var service = BuildService(repo);
            var source = await service.GetDataSourceAsync(AdapterMock().Object, SampleContext());

            Assert.Equal(expected, source);
        }
    }
}
