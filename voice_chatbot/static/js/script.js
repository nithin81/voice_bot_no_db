let recognizing = false;
        const status = document.getElementById('status');
        const recognizedText = document.getElementById('recognizedText');
        const startStopBtn = document.getElementById('startStopBtn');
        const transcription = document.getElementById('transcription');
        const conversationsHeading = document.getElementById('conversations-heading');
        const numUsers = document.getElementById('numUsers');
        const userFields = document.getElementById('userFields');

        let userData = {}; // To store existing user data
        let usernames = []; // To store usernames

        numUsers.addEventListener('input', updateUserFields);

        function updateUserFields() {
            const currentNumUsers = parseInt(numUsers.value) || 0;
            let newUserFields = '';

            // Generate fields for the current number of users
            for (let i = 1; i <= currentNumUsers; i++) {
                const username = userData[`username${i}`] || '';
                const role = userData[`role${i}`] || '';

                newUserFields += `
                    <div class="form-group">
                        <label for="username${i}">Username ${i}</label>
                        <input type="text" class="form-control" id="username${i}" name="username${i}" value="${username}" required>
                    </div>
                    <div class="form-group">
                        <label for="role${i}">Role ${i}</label>
                        <input type="text" class="form-control" id="role${i}" name="role${i}" value="${role}" required>
                    </div>`;
            }

            userFields.innerHTML = newUserFields;
            attachDynamicEventListeners();
            sendFormData(); // Send updated form data to the backend
        }

        function attachDynamicEventListeners() {
            // Attach event listeners to all text inputs
            document.querySelectorAll('input[type="text"]').forEach(input => {
                input.addEventListener('input', () => {
                    userData[input.name] = input.value; // Update userData with current input value
                    sendFormData();
                });
            });
        }

        function downloadCSV() {
            fetch('/download/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                }
            })
            .then(response => {
                if (response.ok) {
                    return response.blob();
                }
                throw new Error('Network response was not ok.');
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'conversation_history.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(error => console.error('Error:', error));
        }

        function sendFormData() {
            const formData = new FormData(document.getElementById('chatbot-form'));
            const data = Object.fromEntries(formData.entries());
            Object.assign(data, userData); // Merge userData with formData

            // Update usernames array
            usernames = [];
            const numUsersValue = parseInt(numUsers.value) || 0;
            for (let i = 1; i <= numUsersValue; i++) {
                if (data[`username${i}`]) {
                    usernames.push(data[`username${i}`].toLowerCase());
                }
            }

            // Remove any user data for users that are no longer active
            for (let i = numUsersValue + 1; i <= Object.keys(userData).length; i++) {
                delete userData[`username${i}`];
                delete userData[`role${i}`];
            }

            fetch('/start/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(data)
            }).then(response => response.json())
              .then(data => console.log('Chatbot settings updated:', data))
              .catch(error => console.error('Error:', error));
        }

        document.getElementById('chatbotName').addEventListener('input', sendFormData);
        document.getElementById('llmModel').addEventListener('change', sendFormData);
        document.getElementById('topic').addEventListener('input', sendFormData);
        numUsers.addEventListener('input', sendFormData);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            status.textContent = "Status: WebRTC not supported";
            startStopBtn.disabled = true;
        } else {
            if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
                status.textContent = "Status: SpeechRecognition API not supported";
                startStopBtn.disabled = true;
            } else {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                const startRecognition = async () => {
                    try {
                        await navigator.mediaDevices.getUserMedia({ audio: true });
                        status.textContent = "Status: Listening...";

                        recognition.onstart = () => {
                            status.textContent = "Status: Recognizing...";
                        };

                        recognition.onspeechend = () => {
                            recognition.stop();
                        };

                        recognition.onresult = (event) => {
                            const result = event.results[0][0].transcript;
                            recognizedText.textContent = "Recognized Text: " + result;

                            // Extract username and content
                            let formattedResult = result;
                            const splitResult = result.split(' ');
                            const possibleUsername = splitResult[0].toLowerCase();
                            console.log(possibleUsername)
                            console.log(usernames)
                            if (usernames.includes(possibleUsername)) {
                                content = splitResult.slice(2).join(' ')
                                formattedResult = '<strong>'+ splitResult[0]+'</strong>' + ': ' +content ;
                                transcription.innerHTML += `<p align="justify">${formattedResult}</p>`;
                                showConversationsHeading();
                                if (content.toLowerCase().includes("stop")) {
                                    window.speechSynthesis.cancel();
                                }
                            }
    
                            // Send the recognized text to the server
                            fetch('/recognize/', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRFToken': getCookie('csrftoken')
                                },
                                body: JSON.stringify({ text: result })
                            }).then(response => response.json())
                                .then(data => {
                                    if (data.status === 'success') {
                                        // Measure the TTS time
                                        const ttsStartTime = performance.now();
                                        //console.log(data.recognized_texts.slice(-1).pop())
                                        botResult = '<strong>'+data.chatbot_name+'</strong>'  + ": "+ data.response ;
                                        transcription.innerHTML += `<p align="justify">${botResult}</p>`;
                                        var u = new SpeechSynthesisUtterance();
                                        u.text = data.response;
                                        u.lang = 'en-US';
                                        u.onend = () => {
                                            const ttsEndTime = performance.now();
                                            const ttsDuration = ttsEndTime - ttsStartTime;
                                            console.log(`TTS Duration: ${ttsDuration} milliseconds`);
                                        };
                                        speechSynthesis.speak(u);
                                    } 
                                    //else {
                                    //    status.textContent = "Status: " + data.message;
                                    //}
                                })
                                .catch(error => console.error('Error:', error));

                        

                            status.textContent = "Status: Idle";

                            if (recognizing) {
                                recognition.start(); // Restart recognition
                            }
                        };

                        recognition.onerror = (event) => {
                            status.textContent = "Status: Error - " + event.error;
                        };

                        recognition.onend = () => {
                            if (recognizing) {
                                recognition.start(); // Restart recognition
                            }
                        };

                        recognition.start();
                    } catch (err) {
                        status.textContent = "Status: Error - " + err.message;
                    }
                };

                document.addEventListener("DOMContentLoaded", function () {
                    if (performance.navigation.type == performance.navigation.TYPE_RELOAD) {
                        // Clear chat history on the server when the page is reloaded
                        fetch('/end/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken')
                            }
                        }).then(response => response.json())
                          .then(data => console.log('Chat history cleared on reload'))
                          .catch(error => console.error('Error:', error));
                    }
                });

                startStopBtn.addEventListener('click', () => {
                    if (startStopBtn.textContent === "Stop Conversation") {
                        recognizing = false;
                        startStopBtn.textContent = "End Conversation";
                        recognition.stop();
                        status.textContent = "Status: Stopped";
                    } else if (startStopBtn.textContent === "End Conversation") {
                        startStopBtn.textContent = "Start Conversation";
                        recognizedText.textContent = "Recognized Text: ";
                        status.textContent = "Status: Idle";
                        transcription.innerHTML = "";
                        window.location.reload();
                        // Clear chat history on the server
                        fetch('/end/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken')
                            }
                        }).then(response => response.json())
                          .then(data => console.log('Chat history cleared'))
                          .catch(error => console.error('Error:', error));
                    } else {
                        recognizing = true;
                        startStopBtn.textContent = "Stop Conversation";

                        // Send form data to the server
                        sendFormData();
                        startRecognition();
                    }
                });
            }
        }

        function reloadPage() {
            fetch('/end/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                }
            }).then(response => response.json())
              .then(data => {
                  console.log('Chat history cleared');
                  window.location.reload(); // Refresh the page
              })
              .catch(error => console.error('Error:', error));
        }

        function getCookie(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== '') {
                const cookies = document.cookie.split(';');
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.substring(0, name.length + 1) === (name + '=')) {
                        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                        break;
                    }
                }
            }
            return cookieValue;
        }

        function showConversationsHeading() {
            conversationsHeading.style.display = 'block';
        }