// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Declares an explicit related entity — drives the website's
//          "Related" block + Schema.org `mentions[]` array. Used for
//          internal-linking authority signals.
// CALLED BY: tools/generate_command_registry.py + generate_mcp_registry.py
//          (collected into `related[]` per page).

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Declares a related entity (another command, tool, app, demo or
    /// workflow). The website surfaces these in the "Related" block at
    /// the bottom of the page and lists them in JSON-LD `mentions[]` for
    /// AI engines to follow.
    ///
    /// USAGE:
    ///   [RelatedTo("command", "ExtendAllConnectorsCommand")]
    ///   [RelatedTo("workflow", "schedules")]
    ///   [RelatedTo("app", "qa-manager")]
    ///   [RelatedTo("demo", "place-svp")]
    ///   [Transaction(TransactionMode.Manual)]
    ///   public class PlaceSvpCommand : ExternalCommand { ... }
    ///
    /// PARAMETERS:
    ///   Kind  — one of: "command", "tool", "app", "service", "demo", "workflow"
    ///   Slug  — the slug of the related entity. Use the C# class name
    ///           for commands; the MCP tool name for tools; the website
    ///           slug for everything else.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class RelatedToAttribute : Attribute
    {
        public string Kind { get; }
        public string Slug { get; }
        public RelatedToAttribute(string kind, string slug)
        {
            Kind = kind ?? throw new ArgumentNullException(nameof(kind));
            Slug = slug ?? throw new ArgumentNullException(nameof(slug));
        }
    }
}
