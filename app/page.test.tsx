import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("Home Page", () => {
  it("renders without crashing", () => {
    render(<Page />);
    expect(document.body).toBeTruthy();
  });
});