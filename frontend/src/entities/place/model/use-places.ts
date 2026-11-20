import { useQuery } from "@tanstack/react-query";
import { fetchPlaces } from "@/shared/api/api";

export function usePlaces(authorId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["places", authorId],
    queryFn: () => fetchPlaces(authorId),
    enabled,
  });
}
