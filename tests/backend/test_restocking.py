"""
Tests for the restocking recommendations endpoint.
"""
import pytest


class TestRestockingEndpoint:
    """Test suite for /api/restocking."""

    def test_returns_200(self, client):
        response = client.get("/api/restocking")
        assert response.status_code == 200

    def test_response_structure(self, client):
        data = client.get("/api/restocking").json()
        assert "recommendations" in data
        assert "total_cost" in data
        assert "within_budget" in data
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["total_cost"], (int, float))
        assert isinstance(data["within_budget"], bool)

    def test_recommendation_fields(self, client):
        data = client.get("/api/restocking").json()
        if not data["recommendations"]:
            pytest.skip("No items below reorder point in test data")

        item = data["recommendations"][0]
        required = ["id", "sku", "name", "category", "warehouse",
                    "quantity_on_hand", "reorder_point", "unit_cost",
                    "suggested_qty", "total_cost", "demand_trend", "priority"]
        for field in required:
            assert field in item, f"Missing field: {field}"

    def test_all_items_below_reorder_point(self, client):
        data = client.get("/api/restocking").json()
        for item in data["recommendations"]:
            assert item["quantity_on_hand"] <= item["reorder_point"], (
                f"{item['sku']}: qty {item['quantity_on_hand']} > reorder {item['reorder_point']}"
            )

    def test_suggested_qty_positive(self, client):
        data = client.get("/api/restocking").json()
        for item in data["recommendations"]:
            assert item["suggested_qty"] > 0
            assert item["total_cost"] > 0

    def test_priority_values(self, client):
        data = client.get("/api/restocking").json()
        valid = {"high", "medium", "low"}
        for item in data["recommendations"]:
            assert item["priority"] in valid, f"Unexpected priority: {item['priority']}"

    def test_demand_trend_values(self, client):
        data = client.get("/api/restocking").json()
        valid = {"increasing", "stable", "decreasing"}
        for item in data["recommendations"]:
            assert item["demand_trend"] in valid, f"Unexpected trend: {item['demand_trend']}"

    def test_total_cost_matches_sum(self, client):
        data = client.get("/api/restocking").json()
        computed = sum(r["total_cost"] for r in data["recommendations"])
        assert abs(data["total_cost"] - computed) < 0.01

    def test_budget_parameter_within_budget(self, client):
        # First find out total cost without budget
        full = client.get("/api/restocking").json()
        total = full["total_cost"]
        # Set budget higher than total — should be within budget
        response = client.get(f"/api/restocking?budget={total + 1000}")
        data = response.json()
        assert data["within_budget"] is True
        assert data["budget"] == pytest.approx(total + 1000, abs=0.01)

    def test_budget_parameter_over_budget(self, client):
        # Set budget to 1 — almost certainly over budget
        response = client.get("/api/restocking?budget=1")
        data = response.json()
        assert data["within_budget"] is False

    def test_no_budget_returns_none_budget_field(self, client):
        data = client.get("/api/restocking").json()
        assert data["budget"] is None
        assert data["within_budget"] is True

    def test_high_priority_items_first(self, client):
        data = client.get("/api/restocking").json()
        recs = data["recommendations"]
        if len(recs) < 2:
            pytest.skip("Need at least 2 recommendations")
        priority_order = {"high": 0, "medium": 1, "low": 2}
        for i in range(len(recs) - 1):
            assert priority_order[recs[i]["priority"]] <= priority_order[recs[i + 1]["priority"]]
