"use client";

import { useReducer } from "react";
import { StageHeadcount } from "@/components/StageHeadcount";
import { StageReceipt } from "@/components/StageReceipt";
import { StageResults } from "@/components/StageResults";
import { appReducer, initialState } from "@/lib/reducer";

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <main className="flex flex-1 flex-col">
      {state.stage === "headcount" && (
        <StageHeadcount
          initialPeople={state.people}
          initialNamePeople={state.namePeople}
          onConfirm={(people, namePeople) => dispatch({ type: "CONFIRM_PEOPLE", people, namePeople })}
        />
      )}

      {state.stage === "receipt" && (
        <StageReceipt
          people={state.people}
          items={state.items}
          tax={state.tax}
          tip={state.tip}
          onSetTax={(rate) => dispatch({ type: "SET_TAX", rate })}
          onSetTip={(rate) => dispatch({ type: "SET_TIP", rate })}
          onAddItem={(item) => dispatch({ type: "ADD_ITEM", item })}
          onRemoveItem={(id) => dispatch({ type: "REMOVE_ITEM", id })}
          onBack={() => dispatch({ type: "BACK_TO_HEADCOUNT" })}
          onContinue={() => dispatch({ type: "GO_TO_RESULTS" })}
        />
      )}

      {state.stage === "results" && (
        <StageResults
          people={state.people}
          items={state.items}
          tax={state.tax}
          tip={state.tip}
          onBack={() => dispatch({ type: "BACK_TO_RECEIPT" })}
          onReset={() => dispatch({ type: "RESET" })}
        />
      )}
    </main>
  );
}
