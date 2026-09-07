import { expect, test } from "@playwright/test";
import { readPlaceSelection } from "../src/features/places/model/place-selection";
import { buildPostsCountryCityFilter } from "../src/features/feed/model/posts-query-params";

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
