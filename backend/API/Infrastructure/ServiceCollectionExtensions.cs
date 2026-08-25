using System.Text;
using Hangfire;
using Hangfire.MySql;
using Hangfire.InMemory;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using API.Infrastructure.Services;
using BAL.BackgroundWorkerService;
using BAL.Interface;
using BAL.Service;
using BAL.Service.ModuleAdapters;
using DAL;
using Model.ViewModel;
using Utils;
using Utils.Cache.Common;
using Utils.Cache.Configuration;
using Utils.Interface;

namespace API.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAppServices(this IServiceCollection services, IConfiguration config)
    {
        // settings
        services.Configure<JwtSettings>(config.GetSection("Jwt"));
        services.Configure<CacheSettings>(config.GetSection("Cache"));
        services.Configure<BAL.Service.ThmsSettings>(config.GetSection("Thms"));
        services.Configure<DataFreshnessPolicyOptions>(config.GetSection("DataFreshnessPolicy"));
        services.Configure<ModuleApiConfigOptions>(config.GetSection("ModuleApiConfig"));

        // data access
        services.AddSingleton<DapperContext>();
        services.AddScoped<IDapperRepository, DapperRepository>();

        // caching (in-memory + distributed memory for session)
        services.AddMemoryCache();
        services.AddDistributedMemoryCache();
        services.AddSingleton<ICacheService, MemoryCacheService>();

        // BAL
        services.AddScoped<ILookupService, LookupService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ITenderService, TenderService>();
        services.AddScoped<IThmsLiveService, ThmsLiveService>();
        services.AddScoped<ITamsLiveService, TamsLiveService>();
        services.AddScoped<IHousingService, HousingService>();
        services.AddScoped<IEnrollmentService, EnrollmentService>();
        services.AddScoped<ISchemeService, SchemeService>();
        services.AddScoped<ITodService, TodService>();
        services.AddScoped<IPatrolService, PatrolService>();
        services.AddScoped<ITipsTimeLiveService, TipsTimeLiveService>();
        services.AddScoped<ITelpLiveService, TelpLiveService>();
        services.AddScoped<ISarvamVoiceService, SarvamVoiceService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<ILLMProviderService, LLMProviderService>();
        services.AddScoped<IRAGService, RAGService>();
        services.AddScoped<IMCPToolService, MCPToolService>();
        services.AddScoped<IAIService, AIService>();
        services.AddSingleton<IUnifiedIngestionService, UnifiedIngestionService>();
        services.AddSingleton<IUnifiedRAGService, UnifiedRAGService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddHttpClient();
        services.AddScoped<DashboardCacheWarmupJob>();
        services.AddScoped<LogCleanupJob>();
        services.AddScoped<HousingSyncJob>();
        services.AddScoped<DynamicSchedulerJob>();
        services.AddScoped<NotificationWorker>();
        services.AddScoped<TncwwbSyncJob>();

        // multi-module dashboard cache: adapters, resilient client, DB-backed cache, MCP tools
        services.AddScoped<IResilientApiClient, ResilientApiClient>();
        services.AddScoped<IDetailCacheRepository, DetailCacheRepository>();
        services.AddSingleton<ISingleFlightRegistry, SingleFlightRegistry>();
        services.AddScoped<IDetailCacheService, DetailCacheService>();
        services.AddScoped<ICountCacheService, CountCacheService>();
        services.AddScoped<IDashboardModuleAdapter, TelpModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, TahdcoSchemeModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, TimePatrol360ModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, ThmsModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, TamsModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, OnePortalMemberModuleAdapter>();
        services.AddScoped<IDashboardModuleAdapter, OnePortalSchemeModuleAdapter>();
        services.AddScoped<IModuleAdapterRegistry, ModuleAdapterRegistry>();
        services.AddScoped<IDashboardMcpToolService, DashboardMcpToolService>();
        services.AddScoped<IDetailRecordRetrievalService, DetailRecordRetrievalService>();

        // infrastructure
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IExternalApiClient, ExternalApiClient>();
        services.AddHttpClient("external", c => c.Timeout = TimeSpan.FromSeconds(30))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
            });

        // mapping (AutoMapper 15: scan mapping profiles from the API assembly)
        services.AddAutoMapper(cfg => cfg.AddMaps(typeof(Program).Assembly));

        return services;
    }

    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration config)
    {
        var jwt = config.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
        var rawKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
        if (string.IsNullOrWhiteSpace(rawKey)) rawKey = jwt.Key;
        if (string.IsNullOrWhiteSpace(rawKey) || rawKey.Length < 32 || rawKey.StartsWith("${"))
        {
            rawKey = "TAHDCO_UDP_ENTERPRISE_JWT_SUPER_SECRET_SIGNING_KEY_2026_SECURE_AUTH!";
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = !string.IsNullOrWhiteSpace(jwt.Issuer) ? jwt.Issuer : "TahdcoUdp",
                    ValidAudience = !string.IsNullOrWhiteSpace(jwt.Audience) ? jwt.Audience : "TahdcoUdpClient",
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(rawKey)),
                    ClockSkew = TimeSpan.FromMinutes(2)
                };
            });
        services.AddAuthorization();
        return services;
    }

    public static IServiceCollection AddSwaggerDocs(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "TAHDCO UDP API",
                Version = "v1",
                Description = "Unified Dashboard Platform — Angular 16 front end, .NET 6 + MySQL back end."
            });
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Paste the JWT from POST /api/v1/auth/login"
            });
            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    },
                    Array.Empty<string>()
                }
            });
        });
        return services;
    }

    public static IServiceCollection AddHangfireJobs(this IServiceCollection services, IConfiguration config)
    {
        var conn = config.GetConnectionString("Default");
        // Append command timeout to connection string if not present
        if (!string.IsNullOrEmpty(conn) && !conn.Contains("Default Command Timeout", StringComparison.OrdinalIgnoreCase))
            conn += "Default Command Timeout=180;";

        services.AddHangfire(h => h
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseInMemoryStorage());
        services.AddHangfireServer();
        return services;
    }

    public static IServiceCollection AddCorsForAngular(this IServiceCollection services, IConfiguration config)
    {
        var origins = config.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? new[] { "http://localhost:4200" };
        services.AddCors(o => o.AddPolicy("ng", p =>
            p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
        return services;
    }
}
