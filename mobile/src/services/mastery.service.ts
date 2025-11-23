import api from "./api";

type ApiResponse<T> = {
  data?: T;
  success?: boolean;
};

const extract = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiResponse<T>).data as T;
  }
  return payload as T;
};

export const updateTopicMastery = async (topicId: number, body: { accuracy?: number; correct?: number; total?: number }) => {
  const response = await api.post(`/api/v2/mastery/topics/${topicId}`, body);
  return extract(response.data);
};

