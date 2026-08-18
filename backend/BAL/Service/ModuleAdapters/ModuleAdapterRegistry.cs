using BAL.Interface;

namespace BAL.Service.ModuleAdapters;

public interface IModuleAdapterRegistry
{
    /// <summary>Resolves the adapter for a module key (DashboardModule.*). Throws
    /// KeyNotFoundException for an unknown module — callers should validate with
    /// DashboardModule.IsValid() first to turn that into a clean 400, not a 500.</summary>
    IDashboardModuleAdapter Get(string module);
    IReadOnlyCollection<string> AvailableModules { get; }
}

/// <summary>All 7 adapters are resolved by DI (each registered as its own interface-less
/// concrete type — see ServiceCollectionExtensions) and indexed here by Module key. This is
/// the one place that maps a module string to a concrete adapter; nothing else in the
/// codebase should switch on module name.</summary>
public class ModuleAdapterRegistry : IModuleAdapterRegistry
{
    private readonly Dictionary<string, IDashboardModuleAdapter> _adapters;

    public ModuleAdapterRegistry(IEnumerable<IDashboardModuleAdapter> adapters)
    {
        _adapters = adapters.ToDictionary(a => a.Module, a => a);
    }

    public IDashboardModuleAdapter Get(string module)
    {
        if (_adapters.TryGetValue(module, out var adapter)) return adapter;
        throw new KeyNotFoundException($"No module adapter registered for '{module}'.");
    }

    public IReadOnlyCollection<string> AvailableModules => _adapters.Keys;
}
