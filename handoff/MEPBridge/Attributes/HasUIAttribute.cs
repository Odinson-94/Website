// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Marks a command as having a desktop UI window or panel.
//          Drives the website's "Has UI" page block + screenshot embed.
// CALLED BY: tools/generate_ui_surfaces.py (extractor)

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Marks a command as having a desktop UI surface (WPF window, dialog,
    /// or panel). The website's command page picks this up via
    /// <c>tools/generate_ui_surfaces.py</c> and renders a "Has UI" section
    /// with the optional screenshot.
    ///
    /// USAGE:
    ///   [HasUI("CobieSheetWindow",
    ///          Type = "WPF",
    ///          Description = "20-sheet tabbed COBie data grid",
    ///          LiveScreenshot = "ui-screenshots/cobie-sheet-window.png")]
    ///   public class OpenCobieSheetWindowCommand : ExternalCommand { }
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class HasUIAttribute : Attribute
    {
        /// <summary>Window/panel class name (e.g. "CobieSheetWindow").</summary>
        public string WindowClass { get; }

        /// <summary>UI framework. One of "WPF", "WinForms", "WebView2".</summary>
        public string Type { get; set; } = "WPF";

        /// <summary>One-line description for the website. ≤ 120 chars.</summary>
        public string Description { get; set; } = "";

        /// <summary>
        /// Repo-relative path to a screenshot of the UI in action.
        /// Convention: <c>Resources/ui-screenshots/&lt;slug&gt;.png</c>.
        /// Optional. The website hides the image block if empty.
        /// </summary>
        public string LiveScreenshot { get; set; } = "";

        public HasUIAttribute(string windowClass)
        {
            WindowClass = windowClass ?? throw new ArgumentNullException(nameof(windowClass));
        }
    }
}
