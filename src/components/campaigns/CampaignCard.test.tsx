import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Campaign } from "@/lib/campaign";
import { CampaignCard, ProgressBar, timeLeftLabel } from "./CampaignCard";

const campaign: Campaign = {
  id: 3,
  creator: "GBSUXN22UTCUYFKQKDE2HTOMZG4DJUWUBXWC6D6EOW627UB777OGOUWU",
  title: "Open-source Stellar tooling",
  goalXlm: "500",
  deadline: new Date(Date.now() + 5 * 86_400_000),
  raisedXlm: "120",
  supporters: 2,
  withdrawn: false,
  status: "active",
  progressPercent: 24,
};

describe("CampaignCard", () => {
  it("renders the title, amounts and supporter count", () => {
    render(<CampaignCard campaign={campaign} />);

    expect(screen.getByText("Open-source Stellar tooling")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/2 /)).toBeInTheDocument();
  });

  it("links to the campaign detail page", () => {
    render(<CampaignCard campaign={campaign} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/campaigns/3");
  });

  it("truncates the creator address", () => {
    render(<CampaignCard campaign={campaign} />);
    expect(screen.getByText("GBSUXN…OGOUWU")).toBeInTheDocument();
  });
});

describe("ProgressBar", () => {
  it("exposes progress to assistive technology", () => {
    render(<ProgressBar percent={42.4} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
  });
});

describe("timeLeftLabel", () => {
  const t = (key: string) =>
    ({
      "campaigns.daysLeft": "days left",
      "campaigns.hoursLeft": "hours left",
      "campaigns.ended": "ended",
    })[key] as string;

  it("reports days for deadlines further than two days out", () => {
    const deadline = new Date(Date.now() + 5 * 86_400_000);
    expect(timeLeftLabel(deadline, t as never)).toBe("5 days left");
  });

  it("reports hours when the deadline is close", () => {
    const deadline = new Date(Date.now() + 6 * 3_600_000);
    expect(timeLeftLabel(deadline, t as never)).toBe("6 hours left");
  });

  it("reports ended for past deadlines", () => {
    expect(timeLeftLabel(new Date(Date.now() - 1000), t as never)).toBe("ended");
  });
});
