import { Form, ActionPanel, Action, showToast, Toast, Clipboard, Detail } from "@raycast/api";
import { useState } from "react";
import { parse, formatISO, format, subMinutes, addMinutes } from "date-fns";

type LogType = "error" | "access";

export default function Command() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [logType, setLogType] = useState<LogType>("error");
  const [result, setResult] = useState<{ utc: string; readable: string; grepCommand: string } | null>(null);

  const handleSubmit = async (values: { time: string; date: Date; logType: LogType }) => {
    try {
      const inputTimeZone = "America/Los_Angeles"; // Assuming PST, adjust if needed
      const parsedTime = parse(values.time, "h:mma", values.date);

      // Combine date and time, assuming the input is in the specified timezone
      const combinedDateTime = new Date(
        values.date.getFullYear(),
        values.date.getMonth(),
        values.date.getDate(),
        parsedTime.getHours(),
        parsedTime.getMinutes(),
      );

      // Convert to UTC
      const utcTime = new Date(combinedDateTime.getTime() + combinedDateTime.getTimezoneOffset() * 60000);
      const utcISOString = formatISO(utcTime);

      const readableUTC = format(utcTime, "MMMM d, yyyy 'at' h:mm a 'UTC'");
      const readableLocal = format(combinedDateTime, "MMMM d, yyyy 'at' h:mm a");

      // Calculate time range for grep command
      const startTime = subMinutes(utcTime, 10);
      const endTime = addMinutes(utcTime, 10);

      let grepCommand = "";
      const logPath = values.logType === "error" ? "/var/log/nginx/error.log" : "/var/log/nginx/access.log";

      if (values.logType === "error") {
        // Format date and time range for error log grep command
        const grepDate = format(utcTime, "yyyy/MM/dd");
        const grepStartTime = format(startTime, "HH:mm:ss");
        const grepEndTime = format(endTime, "HH:mm:ss");

        grepCommand = `grep "${grepDate}" "${logPath}" | awk -v start="${grepStartTime}" -v end="${grepEndTime}" '$2 >= start && $2 <= end'`;
      } else {
        // Format date and time range for access log grep command
        const grepDate = format(utcTime, "dd/MMM/yyyy:HH:mm");
        const grepStartTime = format(startTime, "dd/MMM/yyyy:HH:mm:ss");
        const grepEndTime = format(endTime, "dd/MMM/yyyy:HH:mm:ss");

        grepCommand = `awk -v start="${grepStartTime}" -v end="${grepEndTime}" '$4 >= "["start && $4 <= "["end' "${logPath}" | grep "${grepDate}"`;
      }

      const formattedResult = {
        utc: utcISOString,
        readable: `UTC: ${readableUTC}\n\nLocal: ${readableLocal} (${inputTimeZone})`,
        grepCommand: grepCommand,
      };

      // Copy result to clipboard by default
      await Clipboard.copy(formattedResult.grepCommand);
      setResult(formattedResult);

      showToast({
        style: Toast.Style.Success,
        title: "Converted to UTC",
        message: "Result copied to clipboard",
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Invalid time format. Please use format like '6:30am PST'",
      });
    }
  };

  if (result) {
    return (
      <Detail
        markdown={`# UTC Conversion Result

${result.readable}

## Grep Command for Nginx ${logType.charAt(0).toUpperCase() + logType.slice(1)} Logs

\`\`\`bash
${result.grepCommand}
\`\`\`
`}
        actions={
          <ActionPanel>
            <Action title="Copy Conversion Result" onAction={() => Clipboard.copy(result.readable)} />
            <Action title="Copy Grep Command" onAction={() => Clipboard.copy(result.grepCommand)} />
            <Action title="Convert Another" onAction={() => setResult(null)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="time" title="Time" placeholder="6:30am" value={time} onChange={setTime} />
      <Form.DatePicker id="date" title="Date" value={date} onChange={(newValue) => setDate(newValue ?? new Date())} />
      <Form.Dropdown
        id="logType"
        title="Log Type"
        value={logType}
        onChange={(newValue) => setLogType(newValue as LogType)}
      >
        <Form.Dropdown.Item value="error" title="Error Logs" />
        <Form.Dropdown.Item value="access" title="Access Logs" />
      </Form.Dropdown>
    </Form>
  );
}
