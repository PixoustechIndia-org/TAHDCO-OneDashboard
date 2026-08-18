# Windows SSL/HTTPS Deployment & Certificate Binding Guide

This guide outlines the steps to configure SSL/HTTPS certificates for both the **.NET 8 Backend API** and the **Angular 16 Frontend** on a Windows production server.

---

## 1. IIS (Internet Information Services) Hosting (Recommended for Production)

If hosting the backend API or Angular frontend inside Windows IIS:

### Step 1: Import or Generate SSL Certificate
1. Open **IIS Manager** (`inetmgr`).
2. Select the server node in the left connections tree.
3. Double-click on **Server Certificates** in the center panel.
4. Choose an action:
   * **Import...**: Select a `.pfx` certificate file from a commercial CA (e.g. Let's Encrypt, GoDaddy, DigiCert).
   * **Create Self-Signed Certificate...**: For local staging and testing.

### Step 2: Configure Site HTTPS Binding
1. Expand the **Sites** node in IIS Manager and select your site (e.g., `TahdcoApi`).
2. Click **Bindings...** in the right Actions panel.
3. Click **Add...**.
4. Set **Type** to `https`.
5. Keep **IP address** as `All Unassigned` and set the **Port** to `443` (or a custom port e.g. `5001`).
6. Under **SSL certificate**, select the imported certificate from Step 1.
7. Click **OK** and restart the IIS site.

---

## 2. Kestrel (Direct .NET 8 Executable) Configuration

If running the backend API directly via `dotnet run` or Kestrel service:

### Step 1: Configure Kestrel in `appsettings.json`
Add the Kestrel endpoint configuration block under `appsettings.json` or `appsettings.Production.json`:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://localhost:5000"
      },
      "Https": {
        "Url": "https://localhost:5001",
        "Certificate": {
          "Path": {
            "FilePath": "C:\\Certificates\\tahdco_production.pfx",
            "Password": "YourPFXFilePassword"
          }
        }
      }
    }
  }
}
```

### Step 2: Update Program.cs (Optional)
Ensure the builder reads the configuration and forces HTTPS redirection:

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// Configures HTTPS Redirection
builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = StatusCodes.Status307TemporaryRedirect;
    options.HttpsPort = 5001; // Secure Port
});

var app = builder.Build();

app.UseHttpsRedirection(); // Enable redirection middleware
```

---

## 3. Angular Frontend HTTPS Setup

### Step 1: Update API URL in `environment.prod.ts`
Ensure the frontend environment configuration uses the secure HTTPS API endpoint:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://yourdomain.com/api' // Or 'https://localhost:5001'
};
```

### Step 2: Set up HTTPS for Local Angular Dev Server
If testing the Angular application locally with HTTPS:

Run `ng serve` with the `--ssl` flag:
```bash
ng serve --ssl --ssl-key C:\Certificates\localhost.key --ssl-cert C:\Certificates\localhost.crt
```
Alternatively, configure `angular.json`:
```json
"serve": {
  "options": {
    "ssl": true,
    "sslKey": "C:\\Certificates\\localhost.key",
    "sslCert": "C:\\Certificates\\localhost.crt"
  }
}
```
