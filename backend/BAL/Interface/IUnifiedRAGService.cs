using System.Threading.Tasks;
using Model.ViewModel;

namespace BAL.Interface
{
    public interface IUnifiedRAGService
    {
        Task<UnifiedRAGQueryResultDto> QueryMultiProjectRAGAsync(UnifiedRAGQueryRequestDto request);
    }
}
