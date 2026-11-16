from pathlib import Path

from backend.app.domains.ingestion.weekly_prices import parse_weekly_file


def test_old_xls_nested_layout(fixtures_dir: Path) -> None:
    frame, meta = parse_weekly_file(fixtures_dir / "weekly_nested_2014.xls")

    assert meta["layout"] == "nested"
    assert len(frame) == 4
    first = frame.iloc[0]
    assert (first["product_name"], first["market_name"]) == ("Acelga", "Bogotá, D.C., Corabastos")
    assert (first["min_price"], first["max_price"], first["mean_price"]) == (400, 700, 495)
    assert frame.loc[frame["product_name"] == "Huevo rojo AA", "group_label"].item() == "huevos y lácteos"
    assert any("huevos son $/unidad" in note for note in meta["footnotes"])


def test_recent_xlsx_flat_layout(fixtures_dir: Path) -> None:
    frame, meta = parse_weekly_file(fixtures_dir / "weekly_flat_2025.xlsx")

    assert meta["layout"] == "flat"
    assert list(frame["product_name"]) == ["Papa parda pastusa", "Papa parda pastusa", "Tomate chonto"]
    assert list(frame["market_name"]) == ["Bogotá, D.C., Corabastos", "Chiquinquirá (Boyacá)", "Armenia, Mercar"]
    assert frame["mean_price"].tolist() == [1600, 1450, 2200]
    assert set(frame["group_label"]) == {"Verduras y hortalizas"}
    assert meta["skipped_footnote_rows"] == 1  # the 'Producto | Fuente' row is not data
