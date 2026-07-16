import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CopyField } from "./CopyField";

describe("CopyField", () => {
  it("renders the label and value", () => {
    render(<CopyField label="Public Key (Adres)" value="GABC123" />);
    expect(screen.getByText("Public Key (Adres)")).toBeInTheDocument();
    expect(screen.getByText("GABC123")).toBeInTheDocument();
  });

  it("masks the value until revealed", () => {
    render(<CopyField label="Secret" value="SSECRET" masked />);
    expect(screen.queryByText("SSECRET")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Göster"));
    expect(screen.getByText("SSECRET")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Gizle"));
    expect(screen.queryByText("SSECRET")).not.toBeInTheDocument();
  });

  it("copies the value to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyField label="Adres" value="GXYZ" />);
    fireEvent.click(screen.getByText("Kopyala"));

    expect(writeText).toHaveBeenCalledWith("GXYZ");
    expect(await screen.findByText("Kopyalandı!")).toBeInTheDocument();
  });
});
