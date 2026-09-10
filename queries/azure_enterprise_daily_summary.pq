let
    // The key is stored by Power BI as a Web API credential and is not embedded in this query.
    ApiUrl = "https://YOUR_FUNCTION_APP.azurewebsites.net/api/metrics",
    Response = Json.Document(
        Web.Contents(
            ApiUrl,
            [
                ApiKeyName = "code",
                Headers = [
                    Accept = "application/json"
                ],
                Timeout = #duration(0, 0, 2, 0)
            ]
        )
    ),
    Source = Table.FromRecords(Response),
    ExpandedPullRequests = Table.ExpandRecordColumn(
        Source,
        "pull_requests",
        {
            "total_created",
            "total_created_by_copilot",
            "total_reviewed",
            "total_reviewed_by_copilot",
            "total_merged",
            "total_merged_created_by_copilot",
            "total_merged_reviewed_by_copilot",
            "total_suggestions",
            "total_applied_suggestions",
            "total_copilot_suggestions",
            "total_copilot_applied_suggestions"
        },
        {
            "pr_total_created",
            "pr_created_by_copilot",
            "pr_total_reviewed",
            "pr_reviewed_by_copilot",
            "pr_total_merged",
            "pr_merged_created_by_copilot",
            "pr_merged_reviewed_by_copilot",
            "pr_total_suggestions",
            "pr_total_applied_suggestions",
            "pr_copilot_suggestions",
            "pr_copilot_applied_suggestions"
        }
    ),
    DailySummary = Table.RemoveColumns(
        ExpandedPullRequests,
        {
            "totals_by_ai_adoption_phase",
            "totals_by_feature",
            "totals_by_ide",
            "totals_by_language_feature",
            "totals_by_language_model",
            "totals_by_model_feature"
        },
        MissingField.Ignore
    ),
    Typed = Table.TransformColumnTypes(
        DailySummary,
        {
            {"day", type date},
            {"daily_active_users", Int64.Type},
            {"weekly_active_users", Int64.Type},
            {"monthly_active_users", Int64.Type},
            {"user_initiated_interaction_count", Int64.Type},
            {"code_generation_activity_count", Int64.Type},
            {"code_acceptance_activity_count", Int64.Type},
            {"loc_suggested_to_add_sum", Int64.Type},
            {"loc_suggested_to_delete_sum", Int64.Type},
            {"loc_added_sum", Int64.Type},
            {"loc_deleted_sum", Int64.Type}
        }
    )
in
    Typed
