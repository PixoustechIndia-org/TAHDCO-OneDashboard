using System;
using System.Collections.Generic;

namespace Model.ViewModel
{
    public class UnifiedProjectRecordDto
    {
        public long Id { get; set; }
        public string ProjectName { get; set; } = string.Empty; // TELP | Tahdco Scheme | TIPS+TIME+Patrol360 | THMS | TAMS | One Portal | TOD
        public string SourceAPI { get; set; } = string.Empty;
        public string RecordId { get; set; } = string.Empty;
        public string District { get; set; } = string.Empty;
        public string Division { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Year { get; set; } = "2026";
        public string BeneficiaryName { get; set; } = string.Empty;
        public string SchemeName { get; set; } = string.Empty;
        public int ApplicationCount { get; set; } = 1;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        public string RawJson { get; set; } = "{}";
        public string NormalizedText { get; set; } = string.Empty;
    }

    public class ProjectApiStatusDto
    {
        public string ProjectName { get; set; } = string.Empty;
        public string ApiUrl { get; set; } = string.Empty;
        public string Type { get; set; } = "COUNT"; // COUNT | Detail
        public bool IsHealthy { get; set; } = true;
        public int RecordsFetched { get; set; }
        public long LatencyMs { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime LastSyncTime { get; set; } = DateTime.UtcNow;
    }

    public class UnifiedIngestionSyncResultDto
    {
        public string SyncBatchId { get; set; } = Guid.NewGuid().ToString("N");
        public bool Success { get; set; } = true;
        public double TotalDurationSeconds { get; set; }
        public int TotalRecordsIngested { get; set; }
        public List<ProjectApiStatusDto> ApiStatuses { get; set; } = new List<ProjectApiStatusDto>();
        public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
    }

    public class UnifiedRAGQueryRequestDto
    {
        public string Query { get; set; } = string.Empty;
        public string? ProjectFilter { get; set; } = "All";
        public string? DistrictFilter { get; set; } = "All";
        public int TopK { get; set; } = 5;
    }

    public class UnifiedRAGQueryResultDto
    {
        public string Query { get; set; } = string.Empty;
        public int TotalMatches { get; set; }
        public string AggregatedAnswer { get; set; } = string.Empty;
        public List<UnifiedProjectRecordDto> RetrievedRecords { get; set; } = new List<UnifiedProjectRecordDto>();
        public double ExecutionTimeMs { get; set; }
    }
}
