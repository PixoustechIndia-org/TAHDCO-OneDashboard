using AutoMapper;
using Model.ViewModel;

namespace API.Mapper;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<AppUserRow, UserVm>()
            .ForMember(d => d.Id,        o => o.MapFrom(s => s.UserId))
            .ForMember(d => d.Name,      o => o.MapFrom(s => s.FullName))
            .ForMember(d => d.Privileges, o => o.Ignore())
            .ForMember(d => d.AppAccess, o => o.MapFrom(s =>
                s.AppAccess.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
            .ForMember(d => d.LastLogin, o => o.MapFrom(s =>
                s.LastLogin.HasValue ? s.LastLogin.Value.ToString("yyyy-MM-dd hh:mm tt") : null));
    }
}
