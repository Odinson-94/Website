// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Per-section SEO/AEO H3 phrases that surface as visible H3s on
//          the website AND feed JSON-LD + meta description fallbacks.
//          One [SeoIntent] per section name.
// CALLED BY: tools/generate_command_registry.py + generate_mcp_registry.py
//          (emit `seo: { why_h3, shift_h3, special_h3, who_h3 }` per page).

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Declares an intent-keyword H3 for one section of the page. The
    /// website renders these as visible sub-headings and also feeds them
    /// into JSON-LD signals consumed by Google + AI search engines
    /// (Perplexity, ChatGPT, Claude, Google AI Overviews).
    ///
    /// USAGE — apply once per section:
    ///   [SeoIntent("why",     "Automated MEP schedule builder for Revit")]
    ///   [SeoIntent("shift",   "From hand-built schedules to AI-built schedules with gap analysis")]
    ///   [SeoIntent("special", "One loop that builds, populates and reconciles your Revit schedules")]
    ///   [SeoIntent("who",     "For MEP modellers issuing schedules with house templates")]
    ///   [Transaction(TransactionMode.Manual)]
    ///   public class BuildSchedulesCommand : IExternalCommand { ... }
    ///
    /// AUTHORING GUIDANCE:
    ///   • Phrase as a real search query / question.
    ///   • Lead with the *intent*, not the brand. ("Automated Revit schedule
    ///     builder" beats "Adelphos Schedule Builder is the best...").
    ///   • ≤ 120 characters.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class SeoIntentAttribute : Attribute
    {
        /// <summary>One of: "why", "shift", "special", "who".</summary>
        public string Section { get; }

        /// <summary>The intent-keyword phrase. ≤ 120 chars.</summary>
        public string Phrase { get; }

        public SeoIntentAttribute(string section, string phrase)
        {
            Section = section ?? throw new ArgumentNullException(nameof(section));
            Phrase  = phrase  ?? throw new ArgumentNullException(nameof(phrase));
        }
    }
}
