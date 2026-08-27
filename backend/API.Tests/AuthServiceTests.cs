using System.Threading.Tasks;
using Xunit;
using Moq;
using BAL.Service;
using BAL.Interface;
using DAL;
using AutoMapper;
using Microsoft.Extensions.Options;
using Model.ViewModel;
using Utils;
using System.Collections.Generic;

namespace API.Tests
{
    public class AuthServiceTests
    {
        private readonly Mock<IDapperRepository> _mockDb;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IOptions<JwtSettings>> _mockJwtOptions;
        private readonly AuthService _authService;

        public AuthServiceTests()
        {
            _mockDb = new Mock<IDapperRepository>();
            _mockMapper = new Mock<IMapper>();
            _mockJwtOptions = new Mock<IOptions<JwtSettings>>();
            
            _mockJwtOptions.Setup(x => x.Value).Returns(new JwtSettings 
            { 
                Key = "super_secret_test_key_which_must_be_long_enough", 
                Issuer = "TestIssuer", 
                Audience = "TestAudience",
                ExpiryMinutes = 60
            });

            _authService = new AuthService(_mockDb.Object, _mockMapper.Object, _mockJwtOptions.Object);
        }

        [Fact]
        public async Task LoginAsync_InvalidEmail_ReturnsNull()
        {
            // Arrange
            var req = new LoginRequest("nonexistent@test.com", "Password123!");
            _mockDb.Setup(db => db.QueryFirstOrDefaultAsync<AppUserRow>(It.IsAny<string>(), It.IsAny<object>()))
                   .ReturnsAsync((AppUserRow)null);

            // Act
            var result = await _authService.LoginAsync(req);

            // Assert
            Assert.Null(result);
        }

        [Fact]
        public async Task LoginAsync_WrongPassword_ReturnsNull()
        {
            // Arrange
            var req = new LoginRequest("user@test.com", "wrongpassword");
            var mockUser = new AppUserRow { Email = "user@test.com", Role = "user", PasswordHash = "dummyhash", PasswordSalt = "dummysalt" };
            
            _mockDb.Setup(db => db.QueryFirstOrDefaultAsync<AppUserRow>(It.IsAny<string>(), It.IsAny<object>()))
                   .ReturnsAsync(mockUser);

            // Act
            var result = await _authService.LoginAsync(req);

            // Assert
            Assert.Null(result); // Since dummyhash won't match "wrongpassword"
        }

        [Fact]
        public async Task LoginAsync_ValidCredentials_ReturnsToken()
        {
            // Arrange
            var req = new LoginRequest("admin@tahdco.in", "Password123!");
            var mockUser = new AppUserRow { UserId = 1, Email = "admin@tahdco.in", Role = "admin", FullName = "Admin", PasswordHash = "c2f7199e45e2629bafce665b01d3269df1da68c1d13d133aa01d72e94a6a095e", PasswordSalt = "salt123", IsActive = true };
            
            _mockDb.Setup(db => db.QueryFirstOrDefaultAsync<AppUserRow>(It.IsAny<string>(), It.IsAny<object>()))
                   .ReturnsAsync(mockUser);
                   
            _mockDb.Setup(db => db.QueryAsync<PrivilegeRow>(It.IsAny<string>(), It.IsAny<object>()))
                   .ReturnsAsync(new List<PrivilegeRow>());

            _mockMapper.Setup(m => m.Map<UserVm>(It.IsAny<AppUserRow>())).Returns(new UserVm { Email = "admin@tahdco.in", Privileges = new Dictionary<string, ProjectPrivilege>() });

            // Act
            var result = await _authService.LoginAsync(req);

            // Assert
            Assert.NotNull(result);
            Assert.NotNull(result.Token);
            Assert.Equal("admin@tahdco.in", result.User.Email);
        }
    }
}
