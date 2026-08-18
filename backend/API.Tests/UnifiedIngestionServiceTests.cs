using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using BAL.Service;
using Moq;
using Moq.Protected;
using Xunit;
using System.Linq;

namespace API.Tests
{
    public class UnifiedIngestionServiceTests
    {
        private Mock<IHttpClientFactory> _httpClientFactoryMock;
        private Mock<HttpMessageHandler> _httpMessageHandlerMock;
        private HttpClient _httpClient;
        
        public UnifiedIngestionServiceTests()
        {
            _httpMessageHandlerMock = new Mock<HttpMessageHandler>();
            _httpClient = new HttpClient(_httpMessageHandlerMock.Object)
            {
                BaseAddress = new Uri("http://localhost")
            };

            _httpClientFactoryMock = new Mock<IHttpClientFactory>();
            _httpClientFactoryMock.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(_httpClient);
        }

        [Fact]
        public async Task SyncAllProjectApisAsync_CompletesSuccessfully_And_ReturnsResult()
        {
            // Arrange
            _httpMessageHandlerMock.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent("{}")
                });

            var service = new UnifiedIngestionService(_httpClientFactoryMock.Object);

            // Act
            var result = await service.SyncAllProjectApisAsync();

            // Assert
            Assert.True(result.Success);
            Assert.NotNull(result.SyncBatchId);
            Assert.True(result.TotalDurationSeconds >= 0);
            Assert.Equal(9, result.ApiStatuses.Count);
        }

        [Fact]
        public async Task GetRecordsAsync_FiltersByProjectName()
        {
            // Arrange
            var service = new UnifiedIngestionService(_httpClientFactoryMock.Object);

            // Act
            var result = await service.GetRecordsAsync(projectName: "TELP");

            // Assert
            Assert.NotEmpty(result);
            Assert.All(result, r => Assert.Equal("TELP", r.ProjectName));
        }

        [Fact]
        public async Task GetUnifiedDashboardCountsAsync_ReturnsExpectedCounts()
        {
            // Arrange
            var service = new UnifiedIngestionService(_httpClientFactoryMock.Object);

            // Act
            var result = await service.GetUnifiedDashboardCountsAsync();

            // Assert
            Assert.True(result.ContainsKey("TIPS_TotalWorks"));
            Assert.Equal(1542, result["TIPS_TotalWorks"]);
        }
    }
}
