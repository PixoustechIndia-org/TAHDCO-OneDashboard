namespace Model.ViewModel
{
    public class EmailRequest
    {
        public string ToEmail { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string? AttachmentBase64 { get; set; }
        public string? AttachmentFileName { get; set; }
    }
}
