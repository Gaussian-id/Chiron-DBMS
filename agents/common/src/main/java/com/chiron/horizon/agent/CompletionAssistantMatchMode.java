package com.chiron.horizon.agent;

import com.google.gson.annotations.SerializedName;

public enum CompletionAssistantMatchMode {
    @SerializedName("prefix")
    PREFIX,
    @SerializedName("contains")
    CONTAINS
}
