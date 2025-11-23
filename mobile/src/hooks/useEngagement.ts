import { useContext } from "react";
import { EngagementContext } from "../context/EngagementContext";

export const useEngagement = () => {
  const context = useContext(EngagementContext);
  if (!context) {
    throw new Error("useEngagement must be used within an EngagementContextProvider");
  }
  return context;
};

export type UseEngagementReturn = ReturnType<typeof useEngagement>;
