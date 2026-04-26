// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Buckets a command or tool into a mini-project (Drainage,
//          Lighting, Ventilation, etc.). Drives the website's grouped
//          commands inventory at /dist/docs/commands/index.html.
// CALLED BY: tools/generate_command_registry.py (writes pillar field)
//          and tools/generate_mcp_registry.py.

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Assigns a command or MCP tool to one mini-project (a discipline area).
    /// The website uses this to group the commands inventory page and to
    /// power the "Pillar" filter dropdown.
    ///
    /// USAGE:
    ///   [Pillar("Drainage")]
    ///   [Transaction(TransactionMode.Manual)]
    ///   public class PlaceSvpCommand : ExternalCommand { ... }
    ///
    /// CONVENTIONS:
    ///   Use one of the canonical pillar names so the website renders the
    ///   right blurb + sort order:
    ///     "Drainage", "Lighting", "Ventilation",
    ///     "Mechanical Power", "Small Power", "Containment",
    ///     "Fire Alarm", "Combined", "General"
    ///   Anything else falls into "Uncategorised".
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class PillarAttribute : Attribute
    {
        public string Name { get; }
        public PillarAttribute(string name)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
        }
    }
}
