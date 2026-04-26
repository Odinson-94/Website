// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Marks a command as having an embedded React/web-app surface
//          (typically inside a WebView2 panel).
//          Drives the website's "Has Web App" page block + iframe embed.
// CALLED BY: tools/generate_ui_surfaces.py

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Marks a command as having a web-app surface (React + WebView2, or
    /// any HTML-based UI). The website renders an iframe-style preview
    /// pointing at the published web app.
    ///
    /// USAGE:
    ///   [HasWebApp("DocumentController",
    ///              Url          = "/apps/document-controller",
    ///              ReactSource  = "DocumentController/DocumentController.React",
    ///              Description  = "Drawing transmittal + revision tracker")]
    ///   public class LaunchDocumentControllerCommand : ExternalCommand { }
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class HasWebAppAttribute : Attribute
    {
        /// <summary>App slug (used in /apps/&lt;slug&gt;/ URL).</summary>
        public string AppSlug { get; }

        /// <summary>Public URL on adelphos.ai where the live web app is hosted.</summary>
        public string Url { get; set; } = "";

        /// <summary>Repo-relative path to the React source folder.</summary>
        public string ReactSource { get; set; } = "";

        /// <summary>One-line description for the website. ≤ 120 chars.</summary>
        public string Description { get; set; } = "";

        /// <summary>Optional screenshot path (Resources/ui-screenshots/&lt;slug&gt;.png).</summary>
        public string LiveScreenshot { get; set; } = "";

        public HasWebAppAttribute(string appSlug)
        {
            AppSlug = appSlug ?? throw new ArgumentNullException(nameof(appSlug));
        }
    }
}
