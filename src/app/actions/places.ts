import { apiClient } from "@/lib/api/browser-client";
import { codedRefusalOf, type CodedRefusal } from "@/lib/api/coded-error";
import { parsePlaceAnswer, placeRequestPath, placeRequestReady, type PlaceAnswer, type PlaceRequest } from "@/lib/maps/places";

export interface PlacesResult {
  answer: PlaceAnswer | null;
  error: CodedRefusal | null;
}

const NOT_READY: CodedRefusal = { code: "place_query_invalid", message: "The place search is not ready" };
const UNREADABLE: CodedRefusal = { code: "place_answer_unreadable", message: "The place answer is unreadable" };

export async function fetchPlaces(request: PlaceRequest, signal?: AbortSignal): Promise<PlacesResult> {
  if (!placeRequestReady(request)) return { answer: null, error: NOT_READY };
  const response = await apiClient<unknown>(placeRequestPath(request), { method: "GET", signal });
  if (response.error) return { answer: null, error: codedRefusalOf(response.error) };
  try {
    return { answer: parsePlaceAnswer(response.data), error: null };
  } catch {
    return { answer: null, error: UNREADABLE };
  }
}
