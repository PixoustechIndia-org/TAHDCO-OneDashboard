namespace BAL.Interface;

public interface IReportService
{
    Task<byte[]> BuildTenderPdfAsync(string? fyLabel);
    Task<byte[]> BuildTncwwbPdfAsync(string? fyLabel);
}
