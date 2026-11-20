import { useQuery } from "@tanstack/react-query";
import { fetchAuthors } from "@/shared/api/api";

export function useAuthors() {
  return useQuery({ queryKey: ["authors"], queryFn: fetchAuthors });
}
