using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Twilio;
using Twilio.Jwt.AccessToken;
using Twilio.Rest.Video.V1;
using Twilio.Types;

namespace TwilioOpenAppointement.Controllers
{
    public class VideoTokenRequest
    {
        public string Identity { get; set; }
        public string RoomName { get; set; }
        public string UserType { get; set; }
    }

    public class StartRecordingRequest
    {
        public string RoomSid { get; set; }
        public string RoomName { get; set; }
    }

    public class StopRecordingRequest
    {
        public string RoomSid { get; set; } = "";
        public string RoomName { get; set; } = "";
        public string CompositionSid { get; set; } = "";
        public string RecordingSid { get; set; } = "";
    }

    public class DownloadRecordingRequest
    {
        public string MediaUrl { get; set; }
        public string RecordingSid { get; set; }
    }

    public class RecordingStatusResponse
    {
        public string Status { get; set; }
        public string DownloadUrl { get; set; }
        public string Type { get; set; }
        public string Sid { get; set; }
        public int Duration { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class VideoController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;

        public VideoController(IConfiguration config)
        {
            _config = config;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);

            // Initialize Twilio client
            var accountSid = _config["TwilioSettings:AccountSID"];
            var authToken = _config["TwilioSettings:AuthToken"];
            if (!string.IsNullOrEmpty(accountSid) && !string.IsNullOrEmpty(authToken))
            {
                TwilioClient.Init(accountSid, authToken);
            }
        }

        [HttpPost("token")]
        public IActionResult GetVideoToken([FromBody] VideoTokenRequest request)
        {
            if (request == null) return BadRequest("Request body is missing.");
            if (string.IsNullOrWhiteSpace(request.Identity)) return BadRequest("Identity is required.");
            if (string.IsNullOrWhiteSpace(request.RoomName)) return BadRequest("RoomName is required.");

            var accountSid = _config["TwilioSettings:AccountSID"];
            var apiKeySid = _config["TwilioSettings:ApiKeySID"];
            var apiKeySecret = _config["TwilioSettings:ApiKeySecret"];
            var chatServiceSid = _config["TwilioSettings:ChatServiceSID"];

            if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(apiKeySid) || string.IsNullOrEmpty(apiKeySecret))
                return StatusCode(500, "Twilio configuration is missing.");

            var videoGrant = new VideoGrant { Room = request.RoomName };
            var chatGrant = new ChatGrant { ServiceSid = chatServiceSid };

            var token = new Token(
                accountSid,
                apiKeySid,
                apiKeySecret,
                request.Identity,
                grants: new HashSet<IGrant> { videoGrant, chatGrant }
            );

            return Ok(new { token = token.ToJwt(), roomName = request.RoomName });
        }

        private async Task<string> GetRoomSid(string roomName)
        {
            try
            {
                var room = await RoomResource.FetchAsync(pathSid: roomName);
                return room?.Sid;
            }
            catch
            {
                return null;
            }
        }

        [HttpPost("start-recording")]
        public async Task<IActionResult> StartRecording([FromBody] StartRecordingRequest request)
        {
            try
            {
                if (request == null) return BadRequest("Request body is missing.");
                if (string.IsNullOrWhiteSpace(request.RoomName) && string.IsNullOrWhiteSpace(request.RoomSid))
                    return BadRequest("RoomName or RoomSid is required.");

                var accountSid = _config["TwilioSettings:AccountSID"];
                var authToken = _config["TwilioSettings:AuthToken"];

                if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(authToken))
                    return StatusCode(500, "Twilio configuration is missing.");

                string resolvedRoomSid = request.RoomSid;

                if (string.IsNullOrWhiteSpace(resolvedRoomSid))
                {
                    resolvedRoomSid = await GetRoomSid(request.RoomName);
                    if (string.IsNullOrWhiteSpace(resolvedRoomSid))
                        return BadRequest("Could not find room.");
                }

                var authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));

                // HYBRID APPROACH: Try room recording first (better for short recordings), then fallback to composition

                // OPTION 1: Enable room recording (recommended for short recordings)
                try
                {
                    var roomUpdateUrl = $"https://video.twilio.com/v1/Rooms/{resolvedRoomSid}";
                    var roomUpdateContent = new Dictionary<string, string>
                    {
                        { "Status", "in-progress" },
                        { "RecordParticipantsOnConnect", "true" }
                    };

                    using var roomRequest = new HttpRequestMessage(HttpMethod.Post, roomUpdateUrl);
                    roomRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);
                    roomRequest.Content = new FormUrlEncodedContent(roomUpdateContent);

                    var roomResponse = await _httpClient.SendAsync(roomRequest);

                    if (roomResponse.IsSuccessStatusCode)
                    {
                        Console.WriteLine($"Room recording enabled for room {resolvedRoomSid}");

                        // Wait a moment for recording to initialize
                        await Task.Delay(2000);

                        // Check for existing recordings in this room
                        var recordingsUrl = $"https://video.twilio.com/v1/Recordings?RoomSid={resolvedRoomSid}&Status=processing&PageSize=1";
                        using var recordingsRequest = new HttpRequestMessage(HttpMethod.Get, recordingsUrl);
                        recordingsRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                        var recordingsResp = await _httpClient.SendAsync(recordingsRequest);
                        if (recordingsResp.IsSuccessStatusCode)
                        {
                            var recordingsJson = await recordingsResp.Content.ReadAsStringAsync();
                            using var recordingsDoc = JsonDocument.Parse(recordingsJson);
                            var recordingsArray = recordingsDoc.RootElement.GetProperty("recordings").EnumerateArray();
                            var firstRecording = recordingsArray.FirstOrDefault();

                            if (firstRecording.ValueKind != JsonValueKind.Undefined)
                            {
                                var recordingSid = firstRecording.GetProperty("sid").GetString();
                                return Ok(new
                                {
                                    recordingSid = recordingSid,
                                    roomSid = resolvedRoomSid,
                                    type = "recording",
                                    status = "processing",
                                    message = "Room recording started successfully"
                                });
                            }
                        }

                        // If no recording found yet, return room info
                        return Ok(new
                        {
                            roomSid = resolvedRoomSid,
                            type = "recording",
                            status = "processing",
                            message = "Room recording enabled, waiting for participants"
                        });
                    }
                }
                catch (Exception roomException)
                {
                    Console.WriteLine($"Room recording failed: {roomException.Message}");
                    // Continue to composition fallback
                }

                // OPTION 2: Fallback to composition
                try
                {
                    var compUrl = "https://video.twilio.com/v1/Compositions";
                    var compContent = new Dictionary<string, string>
                    {
                        { "RoomSid", resolvedRoomSid },
                        { "AudioSources", "*" },
                        { "VideoLayout", "{\"grid\":{\"video_sources\":[\"*\"]}}" },
                        { "Format", "mp4" },
                        { "StatusCallback", $"{Request.Scheme}://{Request.Host}/api/video/composition-callback" }
                    };

                    using var requestMessage = new HttpRequestMessage(HttpMethod.Post, compUrl);
                    requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);
                    requestMessage.Content = new FormUrlEncodedContent(compContent);

                    var response = await _httpClient.SendAsync(requestMessage);

                    if (response.IsSuccessStatusCode)
                    {
                        var respJson = await response.Content.ReadAsStringAsync();
                        using var compDoc = JsonDocument.Parse(respJson);
                        var compositionSid = compDoc.RootElement.GetProperty("sid").GetString();
                        var status = compDoc.RootElement.GetProperty("status").GetString();

                        return Ok(new
                        {
                            compositionSid = compositionSid,
                            roomSid = resolvedRoomSid,
                            type = "composition",
                            status = status,
                            message = "Composition recording started successfully"
                        });
                    }
                    else
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        return StatusCode((int)response.StatusCode, new
                        {
                            error = "Failed to create composition",
                            details = errorContent
                        });
                    }
                }
                catch (Exception compException)
                {
                    Console.WriteLine($"Composition also failed: {compException.Message}");
                    return StatusCode(500, new
                    {
                        error = "Both recording methods failed",
                        details = compException.Message
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"StartRecording overall error: {ex}");
                return StatusCode(500, new
                {
                    error = "Internal server error",
                    details = ex.Message
                });
            }
        }
        [HttpPost("recording-callback")]
        public IActionResult RecordingWebhook([FromBody] JsonElement payload)
        {
            try
            {
                var status = payload.GetProperty("Status").GetString();
                var recordingSid = payload.GetProperty("RecordingSid").GetString();
                Console.WriteLine($"Recording {recordingSid} status: {status}");
                return Ok();
            }
            catch
            {
                return Ok();
            }
        }

        [HttpPost("composition-callback")]
        public IActionResult CompositionWebhook([FromBody] JsonElement payload)
        {
            try
            {
                var status = payload.GetProperty("Status").GetString();
                var compositionSid = payload.GetProperty("CompositionSid").GetString();
                Console.WriteLine($"Composition {compositionSid} status: {status}");
                return Ok();
            }
            catch
            {
                return Ok();
            }
        }

        [HttpPost("stop-recording")]
        public async Task<IActionResult> StopRecording([FromBody] StopRecordingRequest request)
        {
            if (request == null) return BadRequest("Request body is missing.");

            var accountSid = _config["TwilioSettings:AccountSID"];
            var authToken = _config["TwilioSettings:AuthToken"];

            if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(authToken))
                return StatusCode(500, "Twilio configuration is missing.");

            try
            {
                var authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));

                // Priority 1: Handle RecordingSid (room recordings)
                if (!string.IsNullOrWhiteSpace(request.RecordingSid))
                {
                    var recordingUrl = $"https://video.twilio.com/v1/Recordings/{request.RecordingSid}";

                    using var requestMessage = new HttpRequestMessage(HttpMethod.Get, recordingUrl);
                    requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var recordingResp = await _httpClient.SendAsync(requestMessage);
                    if (recordingResp.IsSuccessStatusCode)
                    {
                        var recordingJson = await recordingResp.Content.ReadAsStringAsync();
                        using var recordingDoc = JsonDocument.Parse(recordingJson);
                        var status = recordingDoc.RootElement.GetProperty("Status").GetString().ToLower();
                        var duration = recordingDoc.RootElement.TryGetProperty("Duration", out var durElem) ?
                                      durElem.GetInt32() : 0;

                        if (status == "completed")
                        {
                            var mediaUrl = $"https://video.twilio.com/v1/Recordings/{request.RecordingSid}/Media";
                            return Ok(new
                            {
                                recordingSid = request.RecordingSid,
                                status = "completed",
                                type = "recording",
                                duration = duration,
                                downloadUrl = mediaUrl,
                                sid = request.RecordingSid,
                                message = "Recording is ready for download"
                            });
                        }

                        return Ok(new
                        {
                            recordingSid = request.RecordingSid,
                            status = status,
                            type = "recording",
                            duration = duration,
                            sid = request.RecordingSid
                        });
                    }
                }

                // Priority 2: Handle CompositionSid
                if (!string.IsNullOrWhiteSpace(request.CompositionSid))
                {
                    var compositionUrl = $"https://video.twilio.com/v1/Compositions/{request.CompositionSid}";

                    using var requestMessage = new HttpRequestMessage(HttpMethod.Get, compositionUrl);
                    requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var compositionResp = await _httpClient.SendAsync(requestMessage);
                    if (compositionResp.IsSuccessStatusCode)
                    {
                        var compositionJson = await compositionResp.Content.ReadAsStringAsync();
                        using var compositionDoc = JsonDocument.Parse(compositionJson);
                        var status = compositionDoc.RootElement.GetProperty("status").GetString();
                        var duration = compositionDoc.RootElement.TryGetProperty("duration", out var durElem) ?
                                      durElem.GetInt32() : 0;

                        // Handle stuck compositions with 0 duration
                        if (status == "enqueued" && duration == 0)
                        {
                            Console.WriteLine($"Composition {request.CompositionSid} is stuck in enqueued with 0 duration. Checking for room recordings...");

                            // Try to find room recordings as fallback
                            string resolvedRoomSid = request.RoomSid;
                            if (string.IsNullOrWhiteSpace(resolvedRoomSid) && !string.IsNullOrWhiteSpace(request.RoomName))
                            {
                                resolvedRoomSid = await GetRoomSid(request.RoomName);
                            }

                            if (!string.IsNullOrWhiteSpace(resolvedRoomSid))
                            {
                                var recordingsUrl = $"https://video.twilio.com/v1/Recordings?RoomSid={resolvedRoomSid}&Status=completed&PageSize=10";
                                using var recordingsRequest = new HttpRequestMessage(HttpMethod.Get, recordingsUrl);
                                recordingsRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                                var recordingsResp = await _httpClient.SendAsync(recordingsRequest);
                                if (recordingsResp.IsSuccessStatusCode)
                                {
                                    var recordingsJson = await recordingsResp.Content.ReadAsStringAsync();
                                    using var recordingsDoc = JsonDocument.Parse(recordingsJson);
                                    var recordingsArray = recordingsDoc.RootElement.GetProperty("recordings").EnumerateArray();
                                    var latestRecording = recordingsArray.OrderByDescending(r =>
                                        DateTime.Parse(r.GetProperty("date_created").GetString())).FirstOrDefault();

                                    if (latestRecording.ValueKind != JsonValueKind.Undefined)
                                    {
                                        var recordingSid = latestRecording.GetProperty("sid").GetString();
                                        var recordingDuration = latestRecording.TryGetProperty("duration", out var recDurElem) ?
                                                              recDurElem.GetInt32() : 0;

                                        var mediaUrl = $"https://video.twilio.com/v1/Recordings/{recordingSid}/Media";
                                        return Ok(new
                                        {
                                            recordingSid = recordingSid,
                                            status = "completed",
                                            type = "recording",
                                            duration = recordingDuration,
                                            downloadUrl = mediaUrl,
                                            sid = recordingSid,
                                            message = "Found completed room recording as fallback"
                                        });
                                    }
                                }
                            }
                        }

                        if (status == "completed")
                        {
                            var mediaUrl = $"https://video.twilio.com/v1/Compositions/{request.CompositionSid}/Media?Ttl=3600";
                            return Ok(new
                            {
                                compositionSid = request.CompositionSid,
                                status = "completed",
                                type = "composition",
                                duration = duration,
                                downloadUrl = mediaUrl,
                                sid = request.CompositionSid,
                                message = "Recording is ready for download"
                            });
                        }

                        return Ok(new
                        {
                            compositionSid = request.CompositionSid,
                            status = status,
                            type = "composition",
                            duration = duration,
                            sid = request.CompositionSid
                        });
                    }
                    else
                    {
                        var errorContent = await compositionResp.Content.ReadAsStringAsync();
                        return StatusCode((int)compositionResp.StatusCode, new
                        {
                            error = "Failed to fetch composition status",
                            details = errorContent
                        });
                    }
                }

                // Priority 3: Fallback to room-based lookup
                string resolvedRoomSid = request.RoomSid;

                if (string.IsNullOrWhiteSpace(resolvedRoomSid) && !string.IsNullOrWhiteSpace(request.RoomName))
                {
                    resolvedRoomSid = await GetRoomSid(request.RoomName);
                    if (string.IsNullOrWhiteSpace(resolvedRoomSid))
                        return BadRequest("Could not find room.");
                }

                if (!string.IsNullOrWhiteSpace(resolvedRoomSid))
                {
                    // First check for room recordings (more reliable for short recordings)
                    var recordingsUrl = $"https://video.twilio.com/v1/Recordings?RoomSid={resolvedRoomSid}&PageSize=10";
                    using var recordingsRequest = new HttpRequestMessage(HttpMethod.Get, recordingsUrl);
                    recordingsRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var recordingsResp = await _httpClient.SendAsync(recordingsRequest);
                    if (recordingsResp.IsSuccessStatusCode)
                    {
                        var recordingsJson = await recordingsResp.Content.ReadAsStringAsync();
                        using var recordingsDoc = JsonDocument.Parse(recordingsJson);
                        var recordingsArray = recordingsDoc.RootElement.GetProperty("recordings").EnumerateArray();
                        var latestRecording = recordingsArray.OrderByDescending(r =>
                            DateTime.Parse(r.GetProperty("date_created").GetString())).FirstOrDefault();

                        if (latestRecording.ValueKind != JsonValueKind.Undefined)
                        {
                            var recordingSid = latestRecording.GetProperty("sid").GetString();
                            var status = latestRecording.GetProperty("Status").GetString().ToLower();
                            var duration = latestRecording.TryGetProperty("Duration", out var durElem) ?
                                          durElem.GetInt32() : 0;

                            if (status == "completed")
                            {
                                var mediaUrl = $"https://video.twilio.com/v1/Recordings/{recordingSid}/Media";
                                return Ok(new
                                {
                                    recordingSid = recordingSid,
                                    status = "completed",
                                    type = "recording",
                                    duration = duration,
                                    downloadUrl = mediaUrl,
                                    sid = recordingSid,
                                    message = "Recording is ready for download"
                                });
                            }

                            return Ok(new
                            {
                                recordingSid = recordingSid,
                                status = status,
                                type = "recording",
                                duration = duration,
                                sid = recordingSid
                            });
                        }
                    }

                    // Then check for compositions
                    var compositionsUrl = $"https://video.twilio.com/v1/Compositions?RoomSid={resolvedRoomSid}&PageSize=10";
                    using var compositionsRequest = new HttpRequestMessage(HttpMethod.Get, compositionsUrl);
                    compositionsRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var compResp = await _httpClient.SendAsync(compositionsRequest);
                    if (compResp.IsSuccessStatusCode)
                    {
                        var compJson = await compResp.Content.ReadAsStringAsync();
                        using var compDoc = JsonDocument.Parse(compJson);
                        var compArray = compDoc.RootElement.GetProperty("compositions").EnumerateArray();

                        var mostRecentComp = compArray.OrderByDescending(c =>
                            DateTime.Parse(c.GetProperty("date_created").GetString())).FirstOrDefault();

                        if (mostRecentComp.ValueKind != JsonValueKind.Undefined)
                        {
                            var compositionSid = mostRecentComp.GetProperty("sid").GetString();
                            var status = mostRecentComp.GetProperty("status").GetString();
                            var duration = mostRecentComp.TryGetProperty("duration", out var durElem) ?
                                          durElem.GetInt32() : 0;

                            if (status == "completed")
                            {
                                var mediaUrl = $"https://video.twilio.com/v1/Compositions/{compositionSid}/Media?Ttl=3600";
                                return Ok(new
                                {
                                    compositionSid = compositionSid,
                                    status = "completed",
                                    type = "composition",
                                    duration = duration,
                                    downloadUrl = mediaUrl,
                                    sid = compositionSid,
                                    message = "Recording is ready for download"
                                });
                            }

                            return Ok(new
                            {
                                compositionSid = compositionSid,
                                status = status,
                                type = "composition",
                                duration = duration,
                                sid = compositionSid
                            });
                        }
                    }
                }

                return Ok(new
                {
                    status = "processing",
                    message = "Recording is being processed. Please try again later."
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"StopRecording error: {ex}");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        [HttpGet("recording-status/{sid}")]
        public async Task<IActionResult> GetRecordingStatus(string sid, [FromQuery] string type = "auto")
        {
            if (string.IsNullOrWhiteSpace(sid))
                return BadRequest("Sid is required.");

            try
            {
                var accountSid = _config["TwilioSettings:AccountSID"];
                var authToken = _config["TwilioSettings:AuthToken"];
                var authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));

                // Auto-detect type based on SID prefix if not specified
                if (type == "auto")
                {
                    type = sid.StartsWith("CJ") ? "composition" : "recording";
                }

                if (type == "recording")
                {
                    var recordingUrl = $"https://video.twilio.com/v1/Recordings/{sid}";

                    using var requestMessage = new HttpRequestMessage(HttpMethod.Get, recordingUrl);
                    requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var recordingResp = await _httpClient.SendAsync(requestMessage);
                    if (!recordingResp.IsSuccessStatusCode)
                    {
                        var errorContent = await recordingResp.Content.ReadAsStringAsync();
                        Console.WriteLine($"Failed to fetch recording {sid}: {errorContent}");
                        return StatusCode((int)recordingResp.StatusCode, "Failed to fetch recording status.");
                    }

                    var recordingJson = await recordingResp.Content.ReadAsStringAsync();
                    using var recordingDoc = JsonDocument.Parse(recordingJson);
                    var status = recordingDoc.RootElement.GetProperty("Status").GetString();
                    var duration = recordingDoc.RootElement.TryGetProperty("Duration", out var durElem) ?
                                  durElem.GetInt32() : 0;

                    var response = new RecordingStatusResponse
                    {
                        Status = status.ToLower(),
                        Type = "recording",
                        Sid = sid,
                        Duration = duration
                    };

                    if (status.ToLower() == "completed")
                    {
                        response.DownloadUrl = $"https://video.twilio.com/v1/Recordings/{sid}/Media";
                    }

                    return Ok(response);
                }
                else
                {
                    // Handle compositions
                    var compositionUrl = $"https://video.twilio.com/v1/Compositions/{sid}";

                    using var requestMessage = new HttpRequestMessage(HttpMethod.Get, compositionUrl);
                    requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                    var compositionResp = await _httpClient.SendAsync(requestMessage);
                    if (!compositionResp.IsSuccessStatusCode)
                    {
                        var errorContent = await compositionResp.Content.ReadAsStringAsync();
                        Console.WriteLine($"Failed to fetch composition {sid}: {errorContent}");
                        return StatusCode((int)compositionResp.StatusCode, "Failed to fetch composition status.");
                    }

                    var compositionJson = await compositionResp.Content.ReadAsStringAsync();
                    using var compositionDoc = JsonDocument.Parse(compositionJson);
                    var status = compositionDoc.RootElement.GetProperty("status").GetString();
                    var duration = compositionDoc.RootElement.TryGetProperty("duration", out var durElem) ?
                                  durElem.GetInt32() : 0;

                    var response = new RecordingStatusResponse
                    {
                        Status = status,
                        Type = "composition",
                        Sid = sid,
                        Duration = duration
                    };

                    if (status == "completed")
                    {
                        response.DownloadUrl = $"https://video.twilio.com/v1/Compositions/{sid}/Media?Ttl=3600";
                    }

                    return Ok(response);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GetRecordingStatus error: {ex}");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        [HttpPost("download-recording")]
        public async Task<IActionResult> DownloadRecording([FromBody] DownloadRecordingRequest request)
        {
            if (request == null) return BadRequest("Request body is missing.");

            var accountSid = _config["TwilioSettings:AccountSID"];
            var authToken = _config["TwilioSettings:AuthToken"];

            if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(authToken))
                return StatusCode(500, "Twilio configuration is missing.");

            try
            {
                string mediaUrl;
                string filename = "recording.mp4";

                if (!string.IsNullOrEmpty(request.RecordingSid))
                {
                    // Handle recording SID (could be composition SID)
                    if (request.RecordingSid.StartsWith("CJ"))
                    {
                        // This is a composition SID
                        mediaUrl = $"https://video.twilio.com/v1/Compositions/{request.RecordingSid}/Media?Ttl=3600";
                        filename = $"composition_{request.RecordingSid}.mp4";
                    }
                    else
                    {
                        // This is a recording SID
                        mediaUrl = $"https://video.twilio.com/v1/Recordings/{request.RecordingSid}/Media";
                        filename = $"recording_{request.RecordingSid}.mp4";
                    }
                }
                else if (!string.IsNullOrEmpty(request.MediaUrl))
                {
                    mediaUrl = request.MediaUrl;
                    filename = "recording.mp4";
                }
                else
                {
                    return BadRequest("MediaUrl or RecordingSid is required.");
                }

                var authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));

                using var requestMessage = new HttpRequestMessage(HttpMethod.Get, mediaUrl);
                requestMessage.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                var response = await _httpClient.SendAsync(requestMessage);
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"Download failed for {mediaUrl}: {errorContent}");
                    return StatusCode((int)response.StatusCode, $"Failed to download recording: {errorContent}");
                }

                var content = await response.Content.ReadAsByteArrayAsync();
                var contentType = response.Content.Headers.ContentType?.ToString() ?? "video/mp4";

                return File(content, contentType, filename);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DownloadRecording error: {ex}");
                return StatusCode(500, new { error = "Internal server error", details = ex.Message });
            }
        }

        [HttpDelete("cleanup-recordings")]
        public async Task<IActionResult> CleanupRecordings()
        {
            try
            {
                var accountSid = _config["TwilioSettings:AccountSID"];
                var authToken = _config["TwilioSettings:AuthToken"];
                var authHeader = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));

                // Delete compositions in enqueued state with 0 duration
                var compositionsUrl = "https://video.twilio.com/v1/Compositions?Status=enqueued";

                using var compRequest = new HttpRequestMessage(HttpMethod.Get, compositionsUrl);
                compRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);

                var compResp = await _httpClient.SendAsync(compRequest);
                if (compResp.IsSuccessStatusCode)
                {
                    var compJson = await compResp.Content.ReadAsStringAsync();
                    using var compDoc = JsonDocument.Parse(compJson);
                    var compArray = compDoc.RootElement.GetProperty("compositions").EnumerateArray();

                    foreach (var comp in compArray)
                    {
                        var compSid = comp.GetProperty("sid").GetString();
                        var duration = comp.TryGetProperty("duration", out var durElem) ? durElem.GetInt32() : 0;

                        if (duration == 0)
                        {
                            var deleteUrl = $"https://video.twilio.com/v1/Compositions/{compSid}";
                            using var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, deleteUrl);
                            deleteRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", authHeader);
                            await _httpClient.SendAsync(deleteRequest);
                        }
                    }
                }

                return Ok(new { message = "Cleanup completed" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Cleanup failed", details = ex.Message });
            }
        }
    }
}