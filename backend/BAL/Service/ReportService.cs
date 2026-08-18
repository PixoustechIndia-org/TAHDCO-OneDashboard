using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using BAL.Interface;

namespace BAL.Service;

/// <summary>QuestPDF export: district-wise tender status report.</summary>
public class ReportService : IReportService
{
    private readonly ILookupService _lookup;
    private readonly ITenderService _tender;

    public ReportService(ILookupService lookup, ITenderService tender)
    { _lookup = lookup; _tender = tender; }

    public async Task<byte[]> BuildTenderPdfAsync(string? fyLabel)
    {
        var fyId = await _lookup.GetFyIdAsync(fyLabel);
        var summary = await _tender.GetSummaryAsync(fyId);
        var rows = (await _tender.GetDistrictsAsync(fyId, null, null)).ToList();
        var fy = string.IsNullOrWhiteSpace(fyLabel) ? "FY 2025-26" : fyLabel;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("TAHDCO — Tender Management (TIPS + TIME)")
                            .SemiBold().FontSize(14).FontColor("#0a1628");
                        col.Item().Text($"District-wise status · {fy} · generated {DateTime.Now:dd MMM yyyy HH:mm}")
                            .FontSize(8).FontColor(Colors.Grey.Darken1);
                    });
                });

                page.Content().PaddingVertical(10).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.ConstantColumn(24); c.RelativeColumn(2); c.RelativeColumn(2);
                        for (var i = 0; i < 6; i++) c.RelativeColumn();
                    });

                    void Head(string t) => table.Cell().Background("#0a1628").Padding(4)
                        .Text(t).FontColor(Colors.White).FontSize(8).SemiBold();
                    Head("#"); Head("Division"); Head("District"); Head("Total"); Head("In prog");
                    Head("Slow"); Head("Not started"); Head("M-book"); Head("Pay pend");

                    var i = 0;
                    foreach (var r in rows)
                    {
                        var bg = i++ % 2 == 0 ? Colors.White : "#f5f6fa";
                        void Cell(string t) => table.Cell().Background(bg).Padding(4).Text(t).FontSize(8);
                        Cell(i.ToString()); Cell(r.Division); Cell(r.District);
                        Cell(r.TotalWorks.ToString()); Cell(r.InProgress.ToString()); Cell(r.SlowProgress.ToString());
                        Cell(r.NotStarted.ToString()); Cell(r.MBookUploaded.ToString()); Cell(r.PaymentPending.ToString());
                    }

                    void Foot(string t) => table.Cell().Background("#fdf8e8").Padding(4)
                        .Text(t).FontSize(8).SemiBold();
                    Foot(""); Foot("Total"); Foot($"{rows.Count} districts");
                    Foot(summary.TotalWorks.ToString()); Foot(summary.InProgress.ToString());
                    Foot(summary.SlowProgress.ToString()); Foot(summary.NotStarted.ToString());
                    Foot(summary.MBookUploaded.ToString()); Foot(summary.PaymentPending.ToString());
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Page ").FontSize(8);
                    t.CurrentPageNumber().FontSize(8);
                    t.Span(" of ").FontSize(8);
                    t.TotalPages().FontSize(8);
                });
            });
        });

        return doc.GeneratePdf();
    }

    public async Task<byte[]> BuildTncwwbPdfAsync(string? fyLabel)
    {
        var fy = string.IsNullOrWhiteSpace(fyLabel) ? "FY 2025-26" : fyLabel;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("TAMIL NADU CONSTRUCTION WORKERS WELFARE BOARD (TNCWWB)")
                            .SemiBold().FontSize(13).FontColor("#0f5b9b");
                        col.Item().Text("Strategic Portfolio & Scheme Assistance Report (Managing Director Viewpoint)")
                            .SemiBold().FontSize(11).FontColor("#d97706");
                        col.Item().Text($"Statewide District Breakdown · {fy} · Generated {DateTime.Now:dd MMM yyyy HH:mm}")
                            .FontSize(8).FontColor(Colors.Grey.Darken1);
                    });
                });

                page.Content().PaddingVertical(10).Column(col =>
                {
                    col.Item().Background("#f1f5f9").Padding(8).Column(box =>
                    {
                        box.Item().Text("TNCWWB STATEWIDE EXECUTIVE SUMMARY").Bold().FontSize(10).FontColor("#0f5b9b");
                        box.Item().Text($"Total Member Registrations: 2,51,483  |  Cards Printed: 2,43,062  |  HQ Approved: 2,43,997");
                        box.Item().Text($"HQ Pending: 2,969  |  DM Pending: 4,458  |  Total Scheme Applications: 2,798");
                    });

                    col.Item().PaddingTop(12).Text("TNCWWB District & Scheme Assistance Breakdown").Bold().FontSize(10).FontColor("#0f2042");

                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(24); c.RelativeColumn(2); c.RelativeColumn(2);
                            c.RelativeColumn(3); c.RelativeColumn(); c.RelativeColumn(); c.RelativeColumn();
                        });

                        void Head(string t) => table.Cell().Background("#0f5b9b").Padding(4)
                            .Text(t).FontColor(Colors.White).FontSize(8).SemiBold();
                        Head("#"); Head("Division"); Head("District"); Head("Scheme Name"); Head("Apply"); Head("Approved"); Head("Pending");

                        var sampleRows = new[]
                        {
                            new { Div = "Trichy", Dist = "Ariyalur", Scheme = "10th Std Passed / 10-ஆம் வகுப்பு தேர்ச்சி", Apply = 12, Appr = 4, Pend = 8 },
                            new { Div = "Trichy", Dist = "Ariyalur", Scheme = "12th Std Passed / 12-ஆம் வகுப்பு தேர்ச்சி", Apply = 18, Appr = 5, Pend = 13 },
                            new { Div = "Chennai", Dist = "Chengalpattu", Scheme = "Marriage Assistance (Daughter) / திருமண உதவி", Apply = 4, Appr = 4, Pend = 0 },
                            new { Div = "Chennai", Dist = "Chengalpattu", Scheme = "Spectacles Assistance / கண்கண்ணாடி உதவி", Apply = 10, Appr = 7, Pend = 3 },
                            new { Div = "Chennai", Dist = "Chennai", Scheme = "10th Std Passed / 10-ஆம் வகுப்பு தேர்ச்சி", Apply = 39, Appr = 12, Pend = 27 },
                            new { Div = "Chennai", Dist = "Chennai", Scheme = "Arts & Science UG Dayscholar", Apply = 44, Appr = 13, Pend = 31 },
                            new { Div = "Chennai", Dist = "Chennai", Scheme = "Maternity Assistance / மகப்பேறு உதவி", Apply = 53, Appr = 17, Pend = 36 },
                            new { Div = "Chennai", Dist = "Chennai", Scheme = "Old Age Pension (Above 60 yrs)", Apply = 96, Appr = 10, Pend = 86 },
                            new { Div = "Chennai", Dist = "Tiruvallur", Scheme = "Spectacles Assistance / கண்கண்ணாடி உதவி", Apply = 113, Appr = 9, Pend = 104 }
                        };

                        var idx = 0;
                        foreach (var r in sampleRows)
                        {
                            var bg = idx++ % 2 == 0 ? Colors.White : "#f8fafc";
                            void Cell(string t) => table.Cell().Background(bg).Padding(4).Text(t).FontSize(8);
                            Cell(idx.ToString()); Cell(r.Div); Cell(r.Dist); Cell(r.Scheme);
                            Cell(r.Apply.ToString()); Cell(r.Appr.ToString()); Cell(r.Pend.ToString());
                        }

                        void Foot(string t) => table.Cell().Background("#fefcf3").Padding(4)
                            .Text(t).FontSize(8).SemiBold();
                        Foot(""); Foot("Total"); Foot("38 Districts"); Foot("Official Scheme Portfolio");
                        Foot("2,798"); Foot("718"); Foot("2,080");
                    });
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Page ").FontSize(8);
                    t.CurrentPageNumber().FontSize(8);
                    t.Span(" of ").FontSize(8);
                    t.TotalPages().FontSize(8);
                });
            });
        });

        return doc.GeneratePdf();
    }
}
