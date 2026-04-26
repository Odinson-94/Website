// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Marks one concrete capability of a command or tool. Multiple
//          [Feature] attributes per class drive the website's "Features"
//          section (the data-driven grid that replaced "What makes it
//          special" in the new template).
// CALLED BY: tools/generate_command_registry.py + generate_mcp_registry.py
//          (both extractors emit a `features` array per class).

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Declares one concrete feature of a command, tool or app surface.
    /// Multiple <see cref="FeatureAttribute"/> instances are allowed per
    /// class; they're emitted in declaration order to <c>features[]</c>
    /// in the registry JSON, which the website renders as a grid of
    /// labelled tiles on the page.
    ///
    /// USAGE:
    ///   [Feature("Workshare-aware",
    ///            "Works on local + central models; respects worksets.")]
    ///   [Feature("Audited transactions",
    ///            "Every write wrapped as a Revit transaction with one-click undo.")]
    ///   [Transaction(TransactionMode.Manual)]
    ///   public class ExtendAllConnectorsCommand : ExternalCommand { ... }
    ///
    /// GROUPING (optional):
    ///   For richer, grouped feature lists (e.g. QA Manager's drawing /
    ///   schedule / spec / model groups) set <see cref="Group"/>. The
    ///   website will render one subsection per distinct group name.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method,
                    AllowMultiple = true, Inherited = false)]
    public sealed class FeatureAttribute : Attribute
    {
        /// <summary>Short feature label (≤ 40 chars). Becomes the tile heading.</summary>
        public string Name { get; }

        /// <summary>One-line description (≤ 140 chars). Appears under the heading.</summary>
        public string Description { get; }

        /// <summary>
        /// Optional grouping label (e.g. "Drawing checks", "Schedule checks").
        /// When present, the website renders feature-groups; otherwise a flat grid.
        /// </summary>
        public string Group { get; set; } = "";

        public FeatureAttribute(string name, string description)
        {
            Name        = name        ?? throw new ArgumentNullException(nameof(name));
            Description = description ?? throw new ArgumentNullException(nameof(description));
        }
    }
}
