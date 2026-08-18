using System.Collections.Generic;
using System.Threading.Tasks;
using API.Controllers;
using BAL.Interface;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;
using Moq;
using Xunit;

namespace API.Tests
{
    public class IngestionControllerTests
    {
        [Fact]
        public async Task TriggerSync_ReturnsOkResult_WithSyncResult()
        {
            // Arrange
            var syncResult = new UnifiedIngestionSyncResultDto { Success = true, TotalRecordsIngested = 100 };
            var ingestionServiceMock = new Mock<IUnifiedIngestionService>();
            var ragServiceMock = new Mock<IUnifiedRAGService>();

            ingestionServiceMock.Setup(s => s.SyncAllProjectApisAsync()).ReturnsAsync(syncResult);

            var controller = new IngestionController(ingestionServiceMock.Object, ragServiceMock.Object);

            // Act
            var result = await controller.TriggerSync();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var returnedResult = Assert.IsType<UnifiedIngestionSyncResultDto>(okResult.Value);
            Assert.True(returnedResult.Success);
            Assert.Equal(100, returnedResult.TotalRecordsIngested);
        }

        [Fact]
        public async Task GetIngestionStatus_ReturnsOkResult()
        {
            // Arrange
            var statusResult = new UnifiedIngestionSyncResultDto { Success = true };
            var ingestionServiceMock = new Mock<IUnifiedIngestionService>();
            var ragServiceMock = new Mock<IUnifiedRAGService>();

            ingestionServiceMock.Setup(s => s.GetIngestionStatusAsync()).ReturnsAsync(statusResult);

            var controller = new IngestionController(ingestionServiceMock.Object, ragServiceMock.Object);

            // Act
            var result = await controller.GetStatus();

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.Equal(statusResult, okResult.Value);
        }
    }
}
