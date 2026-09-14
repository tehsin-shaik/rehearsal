(() => {
  const registry = (globalThis.RehearsalExtractors ??= {});
  const fieldTerms = {
    summary: ["summary", "title"],
    description: ["description"],
    priority: ["priority"],
    labels: ["label", "labels"],
    assignee: ["assignee", "owner"],
  };

  function compact(value) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, 180)
      : "";
  }

  function descriptor(element) {
    if (!(element instanceof globalThis.HTMLElement)) {
      return "";
    }
    const label = element.labels?.[0]?.textContent ?? "";
    return compact(
      [
        element.getAttribute("aria-label"),
        element.getAttribute("name"),
        element.getAttribute("placeholder"),
        label,
      ]
        .filter(Boolean)
        .join(" "),
    ).toLowerCase();
  }

  function matchingField(value) {
    return Object.entries(fieldTerms).find(([, terms]) =>
      terms.some((term) => value.includes(term)),
    )?.[0];
  }

  function visibleField(element, context) {
    if (
      !(element instanceof globalThis.HTMLInputElement) &&
      !(element instanceof globalThis.HTMLTextAreaElement) &&
      !(element instanceof globalThis.HTMLSelectElement)
    ) {
      return false;
    }
    return (
      element.type !== "password" &&
      element.type !== "hidden" &&
      !element.hidden &&
      !context.isSensitiveField(element)
    );
  }

  function issueKey(pathname) {
    return (
      /^\/browse\/([A-Z][A-Z0-9]+-\d+)(?:\/|$)/.exec(pathname)?.[1] ?? null
    );
  }

  registry.jira = {
    matches(hostname) {
      return hostname.endsWith(".atlassian.net");
    },
    inspect(context) {
      const target = context.event?.target;
      if (context.event?.type === "focusout" && visibleField(target, context)) {
        const field = matchingField(descriptor(target));
        if (field !== undefined) {
          context.state.jiraFields ??= {};
          context.state.jiraFields[field] = true;
          if (field === "assignee") {
            context.state.jiraAssigneeSelected = true;
          }
        }
      }

      if (
        context.event?.type === "click" &&
        target instanceof globalThis.Element
      ) {
        const control = target.closest("button, [role='button']");
        const label = compact(
          control?.getAttribute("aria-label") ?? control?.textContent ?? "",
        ).toLowerCase();
        const selectedField = matchingField(label);
        if (selectedField !== undefined) {
          context.state.jiraFields ??= {};
          context.state.jiraFields[selectedField] = true;
        }
        const hasIssueFields = Object.keys(context.state.jiraFields ?? {}).some(
          (field) => field === "summary" || field === "description",
        );
        if (
          (label.includes("create") && label.includes("issue")) ||
          (label === "create" && hasIssueFields)
        ) {
          context.state.jiraCreateIntent = true;
        }
        if (label.includes("assignee") || label.includes("assign")) {
          context.state.jiraAssigneeSelected = true;
        }
      }

      const key = issueKey(context.location.pathname);
      if (
        key === null ||
        !context.state.jiraCreateIntent ||
        context.state.lastJiraIssueKey === key
      ) {
        return [];
      }

      context.state.lastJiraIssueKey = key;
      const completedFields = Object.keys(
        context.state.jiraFields ?? {},
      ).sort();
      const events = [
        {
          sourceApplication: "issue_tracker",
          action: "create_issue",
          intent: "Create a support issue",
          payload: {
            issueKey: key,
            confirmed: true,
            completedFields,
          },
        },
      ];
      if (context.state.jiraAssigneeSelected) {
        events.push({
          sourceApplication: "issue_tracker",
          action: "assign_owner",
          intent: "Assign the routed issue owner",
          payload: { issueKey: key, selectionRecorded: true },
        });
      }
      return events;
    },
  };
})();
