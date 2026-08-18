# ── build ─────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY API.sln .
COPY API/API.csproj     API/
COPY BAL/BAL.csproj     BAL/
COPY DAL/DAL.csproj     DAL/
COPY Model/Model.csproj Model/
COPY Utils/Utils.csproj Utils/
RUN dotnet restore API.sln

COPY . .
RUN dotnet publish API/API.csproj -c Release -o /app/publish /p:UseAppHost=false

# ── runtime ───────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "API.dll"]
