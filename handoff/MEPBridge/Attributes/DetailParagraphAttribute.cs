// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  A long-form, time-savings-quantified description used by the
//          website's new "Description" section (left column of the
//          why-grid, opposite the brand pull-quote).
// CALLED BY: tools/generate_command_registry.py (extractor reads either
//          this attribute OR the <detail> XML doc tag — both supported.)

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// A long-form description of what the command does and how much
    /// time it saves a user, in concrete terms. The website renders this
    /// in the "Description" section, opposite the brand pull-quote.
    ///
    /// AUTHORING GUIDANCE (also in BUILD WEB Plan/Page Type Skills/):
    ///   • 80–180 words.
    ///   • Lead with what it actually does (mechanism, not marketing).
    ///   • Quantify the time saving with a specific scenario
    ///     ("3 days reduced to 1 hour", "12 hours per week saved", etc.).
    ///   • End with the cumulative effect ("across a Stage 3 package…").
    ///   • No bullet points — prose only.
    ///
    /// ALTERNATIVE: the same content can live as an XML doc tag:
    ///   /// &lt;detail&gt;... long-form text ...&lt;/detail&gt;
    /// Both forms are read by the extractor; the attribute wins if both exist.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class DetailParagraphAttribute : Attribute
    {
        /// <summary>The long-form description.</summary>
        public string Text { get; }

        public DetailParagraphAttribute(string text)
        {
            Text = text ?? throw new ArgumentNullException(nameof(text));
        }
    }
}
