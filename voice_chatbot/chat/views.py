import csv
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
import json
import regex as re
from chat import AzonesLLM_Hub
import time

# Global variable to store chatbot settings
chatbot_settings = {}

# Global dictionary to store recognized texts
recognized_texts = {
    'texts': []
}

def index(request):
    return render(request, 'speech.html')

def start_recognition(request):
    global chatbot_settings
    if request.method == 'POST':
        chatbot_settings = json.loads(request.body)
        print("Chatbot settings received:", chatbot_settings)
        global user_names, user_roles, chatbot_name, topic, model_name
        user_names = [chatbot_settings[f"username{i}"] for i in range(1, int(chatbot_settings["numUsers"])+1)]
        print(user_names)
        user_roles = [chatbot_settings[f"role{i}"] for i in range(1, int(chatbot_settings["numUsers"])+1)]
        chatbot_name = chatbot_settings["chatbotName"]
        topic = chatbot_settings["topic"]
        model_name = chatbot_settings["llmModel"]

        return JsonResponse({'status': 'success', 'message': 'Chatbot settings updated'})
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})

# Function to check for keyword
def contains_keyword(text, keyword):
    return keyword.lower() in text.lower()




def recognize(request):
    global recognized_texts
    if request.method == 'POST':
        data = json.loads(request.body)
        user_input = data['text']
        if user_input:
            for i, user_name in enumerate(user_names):
                user_role = user_roles[i]
                if contains_keyword(user_input, f"{user_name} speaking"):
                    user_input_c = re.sub(f"{user_name} speaking", "", user_input, flags=re.IGNORECASE).strip()
                    recognized_texts['texts'].append(f"{user_name.capitalize()}: {user_input_c.capitalize()}")
                    if contains_keyword(user_input_c, chatbot_name):
                        start_time = time.time()  # Start timing

                        response = AzonesLLM_Hub.Azones_query_model_api(recognized_texts['texts'], user_input_c, topic, model_name, chatbot_name, user_names, user_roles)
                        end_time = time.time()  # End timing
                        response_time = end_time - start_time  # Calculate the duration
                        print(f"Response time: {response_time} seconds")  # Print the response time

                        recognized_texts['texts'].append(f"{chatbot_name.capitalize()}: {response.capitalize()}")
                        
                        return JsonResponse({'status': 'success', 'chatbot_name': chatbot_name.capitalize(), "response": response.capitalize()})
                    # return
                    print(recognized_texts['texts']) 
            return JsonResponse({'status': 'error', 'message': 'No username found in the recognized text'})
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'})


def end_recognition(request):
    global chatbot_settings, recognized_texts
    chatbot_settings = {}
    recognized_texts = {'texts': []}
    return JsonResponse({'status': 'success', 'message': 'Chatbot settings and recognized texts cleared'})

def download_conversation_history(request):
    global recognized_texts

    # Create the HttpResponse object with the appropriate CSV header.
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="conversation_history.csv"'

    writer = csv.writer(response)
    writer.writerow(['Name', 'Role', 'Conversation'])

    for text in recognized_texts['texts']:
        # Split the text into name, role, and conversation
        name, conversation = text.split(': ', 1)
        role = next((role for name_i, role in zip(user_names, user_roles) if name_i.lower() == name.lower()), "System")
        writer.writerow([name.capitalize(), role.capitalize(), conversation.capitalize()])

    return response