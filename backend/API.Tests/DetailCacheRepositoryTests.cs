using DAL;
using Moq;
using Xunit;

namespace API.Tests
{
    /// <summary>TEST 14 of 16 (spec section 36) — the "never destroy previously-stored data on
    /// a failed fetch" guarantee is enforced at the SQL layer, not just in application code
    /// (BAL/Service/DetailCacheService.cs's comments rely on this). This test asserts the exact
    /// SQL text MarkFailedAsync sends never mentions response_data or normalized_data, so even a
    /// future refactor of DetailCacheRepository can't accidentally reintroduce a data-clearing
    /// UPDATE on the failure path without breaking this test.</summary>
    public class DetailCacheRepositoryTests
    {
        [Fact]
        public async Task Test14_MarkFailedAsync_SqlNeverTouchesResponseOrNormalizedDataColumns()
        {
            string? capturedSql = null;
            var dapper = new Mock<IDapperRepository>();
            dapper.Setup(d => d.ExecuteAsync(It.IsAny<string>(), It.IsAny<object?>()))
                  .Callback<string, object?>((sql, _) => capturedSql = sql)
                  .ReturnsAsync(1);

            var repo = new DetailCacheRepository(dapper.Object);
            await repo.MarkFailedAsync("TELP|DETAIL|Chennai|statusSavedCount", DateTime.UtcNow);

            Assert.NotNull(capturedSql);
            Assert.DoesNotContain("response_data", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("normalized_data", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("record_count = ", capturedSql, StringComparison.OrdinalIgnoreCase);
            // it must still touch the freshness-signalling columns, or "failure" would never surface
            Assert.Contains("fetched_at", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("status", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("is_stale", capturedSql, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Test14b_UpsertSuccessAsync_IsTheOnlySqlPathThatWritesResponseData()
        {
            string? capturedSql = null;
            var dapper = new Mock<IDapperRepository>();
            dapper.Setup(d => d.ExecuteAsync(It.IsAny<string>(), It.IsAny<object?>()))
                  .Callback<string, object?>((sql, _) => capturedSql = sql)
                  .ReturnsAsync(1);
            dapper.Setup(d => d.QueryFirstOrDefaultAsync<CacheRow>(It.IsAny<string>(), It.IsAny<object?>()))
                  .ReturnsAsync(new CacheRow { Id = 5 });

            var repo = new DetailCacheRepository(dapper.Object);
            await repo.UpsertSuccessAsync("TELP", "DETAIL", "key", "hash", "{}", "{}", "[]", 1, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(10));

            Assert.NotNull(capturedSql);
            Assert.Contains("response_data", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("normalized_data", capturedSql, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("'FRESH'", capturedSql);
        }
    }
}
