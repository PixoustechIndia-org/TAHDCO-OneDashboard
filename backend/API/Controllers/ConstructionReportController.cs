using System;
using System.Security.Claims;
using System.Threading.Tasks;
using BAL.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Model.ViewModel;

namespace API.Controllers
{
    [ApiController]
    [Route("api/v1/construction-work-report")]
    [Route("api/construction-work-report")]
    [AllowAnonymous] // Handles token and fallback guest sessions
    public class ConstructionReportController : ControllerBase
    {
        private readonly IConstructionReportService _service;

        public ConstructionReportController(IConstructionReportService service)
        {
            _service = service;
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard([FromQuery] ConstructionFilterDto filter)
        {
            try
            {
                var userId = GetCurrentUserId();
                var role = GetCurrentUserRole();
                var data = await _service.GetDashboardSummaryAsync(filter, userId, role);
                return Ok(new
                {
                    success = true,
                    message = "ConstructionWork Report dashboard retrieved successfully.",
                    data,
                    errors = (object?)null
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetWorks([FromQuery] ConstructionFilterDto filter)
        {
            try
            {
                var userId = GetCurrentUserId();
                var role = GetCurrentUserRole();
                var (works, totalCount) = await _service.GetWorkListAsync(filter, userId, role);
                var pageSize = filter.PageSize <= 0 ? 20 : filter.PageSize;
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                return Ok(new
                {
                    success = true,
                    message = "Construction work report retrieved successfully.",
                    data = works,
                    pagination = new
                    {
                        page = filter.Page,
                        pageSize,
                        totalRecords = totalCount,
                        totalPages
                    },
                    errors = (object?)null
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetWorkById(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var role = GetCurrentUserRole();
                var work = await _service.GetWorkByIdAsync(id, userId, role);
                if (work == null)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Work details retrieved successfully.",
                    data = work
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateWork([FromBody] ConstructionWorkVm work)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(work.NameOfPremises))
                    return BadRequest(new { success = false, message = "Name of Premises is required." });

                var userId = GetCurrentUserId();
                var created = await _service.CreateWorkAsync(work, userId);
                return CreatedAtAction(nameof(GetWorkById), new { id = created.Id }, new
                {
                    success = true,
                    message = "Construction work created successfully.",
                    data = created
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateWork(int id, [FromBody] ConstructionWorkVm work)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateWorkAsync(id, work, userId);
                if (updated == null)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Construction work updated successfully.",
                    data = updated
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteWork(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var deleted = await _service.DeleteWorkAsync(id, userId);
                if (!deleted)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Construction work deleted successfully."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost("{id:int}/progress")]
        public async Task<IActionResult> UpdateProgress(int id, [FromBody] ConstructionProgressUpdateDto req)
        {
            try
            {
                var userId = GetCurrentUserId();
                var success = await _service.UpdateProgressAsync(id, req, userId);
                if (!success)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Work progress updated and submitted for review successfully."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpGet("{id:int}/progress")]
        public async Task<IActionResult> GetProgressHistory(int id)
        {
            try
            {
                var history = await _service.GetProgressHistoryAsync(id);
                return Ok(new
                {
                    success = true,
                    message = "Progress history retrieved.",
                    data = history
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpGet("schedules")]
        public async Task<IActionResult> GetSchedules([FromQuery] ConstructionFilterDto filter)
        {
            try
            {
                var userId = GetCurrentUserId();
                var list = await _service.GetSchedulesAsync(filter, userId);
                return Ok(new
                {
                    success = true,
                    message = "Construction schedules retrieved successfully.",
                    data = list
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost("schedules")]
        public async Task<IActionResult> CreateSchedule([FromBody] ConstructionScheduleDto schedule)
        {
            try
            {
                var userId = GetCurrentUserId();
                var created = await _service.CreateScheduleAsync(schedule, userId);
                return Ok(new
                {
                    success = true,
                    message = "Construction schedule created successfully.",
                    data = created
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPut("schedules/{id:int}")]
        public async Task<IActionResult> UpdateSchedule(int id, [FromBody] ConstructionScheduleDto schedule)
        {
            try
            {
                var userId = GetCurrentUserId();
                var updated = await _service.UpdateScheduleAsync(id, schedule, userId);
                if (updated == null)
                    return NotFound(new { success = false, message = "Schedule not found." });

                return Ok(new
                {
                    success = true,
                    message = "Schedule updated successfully.",
                    data = updated
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost("schedules/{id:int}/complete")]
        public async Task<IActionResult> CompleteSchedule(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var success = await _service.CompleteScheduleAsync(id, userId);
                if (!success)
                    return NotFound(new { success = false, message = "Schedule not found." });

                return Ok(new
                {
                    success = true,
                    message = "Schedule marked as completed and rolled forward."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost("{id:int}/approve")]
        public async Task<IActionResult> ApproveProgress(int id, [FromBody] ConstructionApprovalActionDto action)
        {
            try
            {
                var userId = GetCurrentUserId();
                var success = await _service.ApproveProgressAsync(id, action, userId);
                if (!success)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Work progress approved successfully."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpPost("{id:int}/reject")]
        public async Task<IActionResult> RejectProgress(int id, [FromBody] ConstructionApprovalActionDto action)
        {
            try
            {
                var userId = GetCurrentUserId();
                var success = await _service.RejectProgressAsync(id, action, userId);
                if (!success)
                    return NotFound(new { success = false, message = $"Construction work #{id} not found." });

                return Ok(new
                {
                    success = true,
                    message = "Work progress rejected and sent back for revision."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportData([FromQuery] ConstructionFilterDto filter)
        {
            try
            {
                var userId = GetCurrentUserId();
                var export = await _service.GetExportDataAsync(filter, userId);
                return Ok(new
                {
                    success = true,
                    message = "Export data prepared successfully.",
                    data = export
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message, data = (object?)null });
            }
        }

        private int GetCurrentUserId()
        {
            var claim = User?.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int id))
                return id;
            return 1;
        }

        private string GetCurrentUserRole()
        {
            var claim = User?.FindFirst(ClaimTypes.Role);
            return claim?.Value ?? "admin";
        }
    }
}
