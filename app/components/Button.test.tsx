import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Button from "./Button";

describe("Button component", () => {
  it("renders the Pay Now button", () => {
    render(<Button />);

    expect(
      screen.getByRole("button", { name: /pay now/i })
    ).toBeInTheDocument();
  });
});


