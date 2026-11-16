from datetime import date

from backend.app.domains.ingestion.weeks import complete_label, iso_week_bounds, iso_week_of_interval, parse_week_label


def test_parse_regular_and_long_labels() -> None:
    assert parse_week_label("20 al 26 de diciembre de 2014") == (date(2014, 12, 20), date(2014, 12, 26))
    assert parse_week_label("20 de diciembre de 2025 - 26 de diciembre de 2025") == (
        date(2025, 12, 20), date(2025, 12, 26))
    assert parse_week_label("28 de marzo al 5 de abril de 2013") == (date(2013, 3, 28), date(2013, 4, 5))
    assert parse_week_label("Boletín número 100") == (None, None)


def test_label_without_year_takes_it_from_file_name() -> None:
    label = complete_label("13 al 19 de diciembre", "Anex_Bol_Semanal_dic13_19_2014.xls")
    assert parse_week_label(label) == (date(2014, 12, 13), date(2014, 12, 19))


def test_regular_saturday_to_friday_week_goes_to_iso_week_of_friday() -> None:
    assert iso_week_of_interval(date(2025, 2, 8), date(2025, 2, 14)) == (2025, 7)


def test_holiday_weeks_are_normalized_to_one_iso_week() -> None:
    # 4-day Holy Week bulletin, Saturday to Wednesday
    assert iso_week_of_interval(date(2019, 4, 13), date(2019, 4, 17)) == (2019, 16)
    # 9-day bulletin across two ISO weeks: most days fall in the week of the end date
    assert iso_week_of_interval(date(2013, 3, 28), date(2013, 4, 5)) == (2013, 14)
    # year end: 24 to 31 December 2020 belongs to ISO week 53 of 2020
    assert iso_week_of_interval(date(2020, 12, 24), date(2020, 12, 31)) == (2020, 53)


def test_iso_week_bounds() -> None:
    assert iso_week_bounds(2025, 7) == (date(2025, 2, 10), date(2025, 2, 16))
    assert iso_week_bounds(2021, 1) == (date(2021, 1, 4), date(2021, 1, 10))
