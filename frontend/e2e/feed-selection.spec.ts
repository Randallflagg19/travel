import { expect, test } from "@playwright/test";
import { readPlaceSelection } from "../src/features/journal-navigation/model/place-selection";
import { buildPostsCountryCityFilter } from "../src/features/journal-navigation/model/posts-query-params";
import { buildJournalUrl } from "../src/features/journal-navigation/model/journal-url";

test("home and explicit all use the same selection and unfiltered API request", () => {
  const expected = { all: true, selectedCountry: "", selectedCity: "" };
  for (const query of ["", "order=asc", "all=true", "all=true&country=Thailand&city=Bangkok"]) {
    const selection = readPlaceSelection(new URLSearchParams(query));
    expect(selection).toEqual(expected);
    expect(buildPostsCountryCityFilter({ ...selection, isCountryFeed: false })).toEqual({});
  }
});

test("country and city selections retain their API filters", () => {
  const city = readPlaceSelection(new URLSearchParams("country=Thailand&city=Bangkok"));
  expect(city.all).toBe(false);
  expect(buildPostsCountryCityFilter({ ...city, isCountryFeed: false })).toEqual({
    country: "Thailand", city: "Bangkok",
  });
  const country = readPlaceSelection(new URLSearchParams("country=Egypt"));
  expect(country).toEqual({ all: false, selectedCountry: "Egypt", selectedCity: "" });
  expect(buildPostsCountryCityFilter({ ...country, isCountryFeed: true })).toEqual({ country: "Egypt" });
});

test("switching journals clears the previous place and delete mode while preserving order", () => {
  const url = buildJournalUrl("author=first&country=Thailand&city=Bangkok&delete=1&order=asc", {
    type: "author", authorId: "second",
  });
  const params = new URL(url, "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toEqual({ author: "second", order: "asc", all: "true" });
});

test("place, order and deletion controls preserve the selected journal", () => {
  let url = buildJournalUrl("author=friend&all=true&order=desc", { type: "city", country: "Таиланд", city: "Бангкок" });
  url = buildJournalUrl(url.split("?")[1], { type: "order", order: "asc" });
  url = buildJournalUrl(url.split("?")[1], { type: "toggle-delete" });
  const params = new URL(url, "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toEqual({ author: "friend", order: "asc", country: "Таиланд", city: "Бангкок", delete: "1" });
  expect(readPlaceSelection(params)).toEqual({ all: false, selectedCountry: "Таиланд", selectedCity: "Бангкок" });
  const allUrl = buildJournalUrl(params.toString(), { type: "all" });
  const all = new URL(allUrl, "http://localhost").searchParams;
  expect(Object.fromEntries(all)).toEqual({ author: "friend", order: "asc", delete: "1", all: "true" });
});

test("country navigation clears the previous city without losing journal or ordering", () => {
  const url = buildJournalUrl("author=friend&country=Thailand&city=Bangkok&order=asc", { type: "country", country: "Egypt" });
  expect(Object.fromEntries(new URL(url, "http://localhost").searchParams)).toEqual({ author: "friend", country: "Egypt", order: "asc" });
});
