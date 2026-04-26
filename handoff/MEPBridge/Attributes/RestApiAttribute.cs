// ═══════════════════════════════════════════════════════════════════════
// STATUS: NEW — to be added to MEPBridge.Revit.Tracking namespace
// ═══════════════════════════════════════════════════════════════════════
//
// DESIGN:  Marks an external command as exposed via the public REST API
//          (POST /api/v1/commands/<name>). Drives:
//            • rest_api_registry.json (extracted by tools/generate_rest_api_registry.py)
//            • OpenAPI spec at /api/openapi.json
//            • Per-command page REST API block
//            • Supabase Edge Function input validator
//
//          Spec follows the Class Structure §REST API Exposure section.
//
// CALLED BY: tools/generate_rest_api_registry.py

using System;

namespace MEPBridge.Revit.Tracking
{
    /// <summary>
    /// Marks a Revit external command as exposed via the public REST API.
    /// External clients call <c>POST /api/v1/commands/&lt;CommandName&gt;</c>;
    /// the request is queued via Supabase, picked up by the plugin,
    /// executed via ExternalEvent, and the result returned async.
    ///
    /// Use <see cref="RestApiParamAttribute"/> for each input parameter and
    /// <see cref="RestApiResponseAttribute"/> for each output field.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
    public sealed class RestApiAttribute : Attribute
    {
        /// <summary>Snake_case external name (e.g. "export_clash_results_to_xml").</summary>
        public string CommandName { get; }

        /// <summary>HTTP method. Almost always "POST".</summary>
        public string Method { get; set; } = "POST";

        /// <summary>True = JWT + API key required.</summary>
        public bool RequiresAuth { get; set; } = true;

        /// <summary>True = returns 202 + job_id; client polls or webhooks.</summary>
        public bool IsAsync { get; set; } = true;

        /// <summary>One-paragraph description for OpenAPI + the docs page.</summary>
        public string Description { get; set; } = "";

        /// <summary>Tier required ("free" | "pro" | "enterprise").</summary>
        public string Tier { get; set; } = "pro";

        public RestApiAttribute(string commandName)
        {
            CommandName = commandName ?? throw new ArgumentNullException(nameof(commandName));
        }
    }

    /// <summary>One REST API request parameter.</summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class RestApiParamAttribute : Attribute
    {
        public string Name { get; }
        public string Type { get; }
        public string Description { get; }
        public bool   Required { get; set; } = false;
        public string Example { get; set; } = "";

        public RestApiParamAttribute(string name, string type, string description)
        {
            Name = name; Type = type; Description = description;
        }
    }

    /// <summary>One REST API response field.</summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true, Inherited = false)]
    public sealed class RestApiResponseAttribute : Attribute
    {
        public string Name { get; }
        public string Type { get; }
        public string Description { get; }

        public RestApiResponseAttribute(string name, string type, string description)
        {
            Name = name; Type = type; Description = description;
        }
    }
}
