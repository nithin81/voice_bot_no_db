from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
import replicate
from dotenv import load_dotenv
import os
load_dotenv()




# Function to initialize the appropriate client and query the model API
def Azones_query_model_api(conversation_histories, input_text, topic, model_name, chatbot_name, user_names, user_roles):
    chat_history = "\n".join([f"{entry}." for entry in conversation_histories])
    users = ", ".join([entry for entry in user_names ])
    roles = ", ".join([entry for entry in user_roles ])
    

    if model_name == "Mistral":
        model = "mistral-large-latest"
        api_key = os.environ["Mistral_api"]
        return query_mistral(model, api_key, chat_history, input_text, topic, chatbot_name, users, roles)

    elif model_name == "LLAMA3":
        model = "meta/meta-llama-3-70b-instruct"
        api_key = os.environ["LLAMA3_api"]
        return query_meta_llama(model, api_key, chat_history, input_text, topic, chatbot_name, users, roles)
    else:
        raise ValueError(f"Model '{model}' is not supported.")

# Function to query Mistral model API
def query_mistral(model, api_key, chat_history, input_text, topic, chatbot_name, users, roles):
    try:
        client = MistralClient(api_key=api_key)
        messages = [ChatMessage(role="user", content=input_text)]
        instruction_message = ChatMessage(
            role="system",
            content=f"You are assigned with the name '{chatbot_name}' and respond only when '{chatbot_name}' is called and there are '{users}' in the conversation and their roles are '{roles}' respectively. Provide a concise, thoughtful, and independent response on the question  '{input_text}' in consideration of '{topic}' in a single statement based on the conversation History: \"'{chat_history}'\", correcting the user if wrong, without repeating previous content, and answering only once to the point. When the user is asking for you to stop then just say only one word that is sorry."
        )
        messages.insert(0, instruction_message)
        chat_response = client.chat(model=model, messages=messages)
        print(messages)
        return chat_response.choices[0].message.content
    except Exception as e:
        print(f"An error occurred: {e}")
        return "There is an server error, Sorry!!!"


# Function to query Meta LLaMA 3-70B Instruct model API using Replicate
def query_meta_llama(model, api_key, chat_history, input_text, topic, chatbot_name, users, roles):
    try:
        os.environ["REPLICATE_API_TOKEN"] = api_key
        # prompt = "\n".join([entry['content'] for entry in chat_history if entry['role'] == 'user']) + f"\nTopic: {topic}\n"
        
        # instruction_message = "Provide a concise, thoughtful, and independent response on the topic '{topic}' in a single statement, correcting the user if wrong, without repeating previous content, and answering only once to the point.Respond only when called, '{chatbot_name}'"
        # prompt = f"{instruction_message}\n{prompt}"
        prompt = f"You are assigned with the name '{chatbot_name}' and respond only when '{chatbot_name}' is called and there are'{users}' in the conversation and their roles are '{roles}' respectively. Provide a concise, thoughtful, and independent response on the question  '{input_text}' in consideration of '{topic}' in a single statement based on the conversation History: \"'{chat_history}'\", correcting the user if wrong, without repeating previous content, and answering only once to the point. When the user is asking for you to stop then just say only one word that is sorry."
        print(prompt)
        # Query the model and collect the response
        response = ""
        for event in replicate.stream(model, input={"prompt": prompt}):
            response += str(event)

        return response.strip()
    except Exception as e:
        print(f"An error occurred: {e}")
        return "There is an server error, Sorry!!!"
