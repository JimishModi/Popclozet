// src/components/ui/InstantAddButton.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import InstantAddButton from "./InstantAddButton";

describe("InstantAddButton", () => {
  const mockOnAdd = vi.fn();
  const mockOnIncrement = vi.fn();
  const mockOnDecrement = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Rent Now" button when quantity is 0', () => {
    render(
      <InstantAddButton
        productId="p1"
        quantity={0}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
        onChange={mockOnChange}
      />
    );

    // Rent Now button should be present
    expect(screen.getByRole("button", { name: /rent now/i })).toBeTruthy();
    // Counter numeric value should not be visible
    expect(screen.queryByText("1")).toBeNull();
  });

  it("renders counter when quantity is > 0", () => {
    render(
      <InstantAddButton
        productId="p1"
        quantity={1}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
        onChange={mockOnChange}
      />
    );

    // The numeric counter should be visible
    expect(screen.getByText("1")).toBeTruthy();
    // The Rent Now button should not be visible in this state
    expect(screen.queryByRole("button", { name: /rent now/i })).toBeNull();
  });

  it('calls onAdd when "Rent Now" is clicked', () => {
    render(
      <InstantAddButton
        productId="p1"
        quantity={0}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
        onChange={mockOnChange}
      />
    );

    const addBtn = screen.getByRole("button", { name: /rent now/i });
    fireEvent.click(addBtn);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
    // onChange should also have been called with quantity 1
    expect(mockOnChange).toHaveBeenCalledWith("p1", 1);
  });

  it('calls onIncrement when "+" is clicked', () => {
    render(
      <InstantAddButton
        productId="p1"
        quantity={1}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
        onChange={mockOnChange}
      />
    );

    const increaseBtn = screen.getByLabelText("Increase quantity");
    fireEvent.click(increaseBtn);
    expect(mockOnIncrement).toHaveBeenCalledTimes(1);
    // onChange should have been invoked with quantity 2
    expect(mockOnChange).toHaveBeenCalledWith("p1", 2);
  });

  it('calls onDecrement when "-" is clicked', () => {
    render(
      <InstantAddButton
        productId="p1"
        quantity={2}
        onAdd={mockOnAdd}
        onIncrement={mockOnIncrement}
        onDecrement={mockOnDecrement}
        onChange={mockOnChange}
      />
    );

    const decreaseBtn = screen.getByLabelText("Decrease quantity");
    fireEvent.click(decreaseBtn);
    expect(mockOnDecrement).toHaveBeenCalledTimes(1);
    // onChange should have been invoked with quantity 1
    expect(mockOnChange).toHaveBeenCalledWith("p1", 1);
  });
});
