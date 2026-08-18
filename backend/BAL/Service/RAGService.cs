using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Model.ViewModel;

namespace BAL.Service
{
    public interface IRAGService
    {
        Task<RAGSearchResultDto> SearchAsync(string query, string category, int topK = 5);
    }

    public class RAGService : IRAGService
    {
        private readonly List<RAGCitationDto> _knowledgeBase = new List<RAGCitationDto>
        {
            new RAGCitationDto
            {
                DocumentId = 101,
                DocumentTitle = "G.O. (Ms) No. 42 - TAHDCO Housing Subsidy Revised Guidelines 2025",
                Category = "GO",
                Excerpt = "Clause 4.2: Maximum subsidy for SC/ST beneficiaries constructing individual housing in plain areas is raised to Rs. 2.25 Lakhs, and in hill areas (Nilgiris/Dindigul) to Rs. 2.75 Lakhs upon stage completion verified in THMS.",
                RelevanceScore = 0.94f
            },
            new RAGCitationDto
            {
                DocumentId = 102,
                DocumentTitle = "TAHDCO Tender Execution Procedure & M-Book Regulation Manual (TIPS-2025)",
                Category = "TenderNotice",
                Excerpt = "Section 8.1: Executive Engineers must verify and submit digitized M-Books within 15 days of stage completion. Pending M-Books over 30 days automatically withhold 10% contractor mobilization advance.",
                RelevanceScore = 0.89f
            },
            new RAGCitationDto
            {
                DocumentId = 103,
                DocumentTitle = "TELP Land Purchase Scheme Guidelines & Eligibility Framework",
                Category = "SchemeGuideline",
                Excerpt = "Section 2.3: Applicants under Tamil Nadu Economic Land Purchase Scheme (TELP) must possess valid community certificate issued by Revenue Authority and annual family income below Rs. 3,00,000.",
                RelevanceScore = 0.87f
            },
            new RAGCitationDto
            {
                DocumentId = 104,
                DocumentTitle = "TAMS Skill Institute Attendance & Placement Standard Operating Procedure",
                Category = "SchemeGuideline",
                Excerpt = "Rule 12: Skill training institutes under TAMS maintaining > 85% student attendance with grade 'Excellent' are eligible for performance incentive disbursement under FY 2025-26 quota.",
                RelevanceScore = 0.82f
            },
            new RAGCitationDto
            {
                DocumentId = 105,
                DocumentTitle = "Patrol360 IoT Infrastructure & Maintenance Charter",
                Category = "GO",
                Excerpt = "Paragraph 5: Any camera asset reported offline exceeding 48 hours requires mandatory site visit by district engineer with logging logged in Patrol360 system.",
                RelevanceScore = 0.79f
            }
        };

        public Task<RAGSearchResultDto> SearchAsync(string query, string category, int topK = 5)
        {
            string q = query.ToLowerInvariant();

            var matches = _knowledgeBase
                .Where(doc => string.IsNullOrEmpty(category) || category.Equals("All", StringComparison.OrdinalIgnoreCase) || doc.Category.Equals(category, StringComparison.OrdinalIgnoreCase))
                .Select(doc =>
                {
                    float score = doc.RelevanceScore;
                    if (doc.Excerpt.ToLowerInvariant().Contains(q) || doc.DocumentTitle.ToLowerInvariant().Contains(q))
                    {
                        score = Math.Min(0.99f, score + 0.10f);
                    }
                    return new RAGCitationDto
                    {
                        DocumentId = doc.DocumentId,
                        DocumentTitle = doc.DocumentTitle,
                        Category = doc.Category,
                        Excerpt = doc.Excerpt,
                        RelevanceScore = score
                    };
                })
                .OrderByDescending(x => x.RelevanceScore)
                .Take(topK)
                .ToList();

            return Task.FromResult(new RAGSearchResultDto
            {
                Query = query,
                TotalMatches = matches.Count,
                Results = matches
            });
        }
    }
}
