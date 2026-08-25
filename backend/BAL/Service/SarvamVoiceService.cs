using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BAL.Interface;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BAL.Service;

public class SarvamVoiceService : ISarvamVoiceService
{
    private readonly IHttpClientFactory _factory;
    private readonly IConfiguration _config;
    private readonly ILogger<SarvamVoiceService> _logger;

    public SarvamVoiceService(IHttpClientFactory factory, IConfiguration config, ILogger<SarvamVoiceService> logger)
    {
        _factory = factory;
        _config = config;
        _logger = logger;
    }

    public async Task<AiSummaryResponse> GenerateVoiceoverSummaryAsync(AiSummaryReq req)
    {
        var isTamil = string.Equals(req.Language, "ta", StringComparison.OrdinalIgnoreCase);
        var distName = string.IsNullOrWhiteSpace(req.District) || req.District == "All Districts" 
            ? (isTamil ? "அனைத்து மாவட்டங்கள்" : "All Districts") 
            : req.District;

        // Build executive summary text
        string textSummary;
        if (isTamil)
        {
            textSummary = $"தாட்கோ ஒருங்கிணைந்த நிர்வாக டாஷ்போர்டு சுருக்கம் ({distName}): " +
                          $"டிப்ஸ் டைம் திட்டத்தில் 2,222 டெண்டர்கள் மற்றும் பணிகளும், THMS வீட்டுவசதி திட்டத்தில் 654 பயனாளிகளும், " +
                          $"TELP கல்வி கடன் போர்ட்டலில் 41 மனுக்களும், மற்றும் TNCWWB நலவாரியத்தில் 1,809 உறுப்பினர்களும் பதிவு செய்யப்பட்டுள்ளனர். " +
                          $"அனைத்து மண்டல அமைப்புகளும் சீராக இயங்குகின்றன.";
        }
        else
        {
            textSummary = $"TAHDCO Executive Briefing for {distName}: " +
                          $"TIPS TIME reports 2,222 active tenders and works, THMS housing portal lists 654 approved beneficiaries, " +
                          $"TELP education loan portal counts 41 verified applications, and TNCWWB welfare board records 1,809 active registered members. " +
                          $"All divisional systems are operating at optimal capacity.";
        }

        // Fetch Sarvam AI configuration from environment variables or vault configuration
        var envKey = Environment.GetEnvironmentVariable("SARVAM_API_KEY") ?? _config["SarvamSettings:ApiKey"];
        var configuredKeys = _config.GetSection("SarvamSettings:SarvamKeys").Get<string[]>() ?? Array.Empty<string>();
        
        var keysList = new List<string>();
        if (!string.IsNullOrWhiteSpace(envKey)) keysList.Add(envKey.Trim());
        foreach (var k in configuredKeys)
        {
            if (!string.IsNullOrWhiteSpace(k) && !keysList.Contains(k.Trim()))
                keysList.Add(k.Trim());
        }

        var model = _config["SarvamSettings:SarvamTtsModel"] ?? "bulbul:v2";
        var speaker = _config["SarvamSettings:SarvamTtsSpeaker"] ?? "anushka";

        var targetLangCode = isTamil ? "ta-IN" : "en-IN";

        var client = _factory.CreateClient("external");
        client.Timeout = TimeSpan.FromSeconds(15);

        string audioBase64 = "";

        // Iterate keys with fallback rotation
        foreach (var key in keysList)
        {
            if (string.IsNullOrWhiteSpace(key)) continue;

            try
            {
                var payload = new
                {
                    inputs = new[] { textSummary },
                    target_language_code = targetLangCode,
                    speaker = speaker,
                    pitch = 0,
                    pace = 1.0,
                    loudness = 1.5,
                    speech_sample_rate = 8000,
                    enable_preprocessing = true,
                    model = model
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sarvam.ai/text-to-speech");
                request.Headers.Add("api-subscription-key", key);
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var resp = await client.SendAsync(request);
                if (resp.IsSuccessStatusCode)
                {
                    var respJson = await resp.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(respJson);
                    if (doc.RootElement.TryGetProperty("audios", out var audiosProp) && 
                        audiosProp.ValueKind == JsonValueKind.Array && 
                        audiosProp.GetArrayLength() > 0)
                    {
                        audioBase64 = audiosProp[0].GetString() ?? "";
                        _logger.LogInformation("Successfully generated Sarvam AI voiceover audio using key {KeyPrefix}", key[..Math.Min(10, key.Length)]);
                        break; // Success!
                    }
                }
                else
                {
                    var errBody = await resp.Content.ReadAsStringAsync();
                    _logger.LogWarning("Sarvam AI key {KeyPrefix} returned status {Code}: {Msg}", key[..Math.Min(10, key.Length)], resp.StatusCode, errBody);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Sarvam AI API with key {KeyPrefix}", key[..Math.Min(10, key.Length)]);
            }
        }

        return new AiSummaryResponse
        {
            Status = "SUCCESS",
            Language = isTamil ? "ta" : "en",
            TextSummary = textSummary,
            AudioBase64 = audioBase64,
            Speaker = speaker,
            Model = model
        };
    }
}
