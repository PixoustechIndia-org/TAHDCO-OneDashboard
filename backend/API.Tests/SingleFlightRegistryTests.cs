using BAL.Service;
using Xunit;

namespace API.Tests
{
    /// <summary>TEST 13 of 16 (spec section 36) — request de-duplication. If many callers ask
    /// for the same key while a fetch for it is already in flight, the expensive factory must
    /// run exactly once and every caller must receive the same result.</summary>
    public class SingleFlightRegistryTests
    {
        [Fact]
        public async Task Test13_ConcurrentCallsWithSameKey_InvokeFactoryExactlyOnce()
        {
            var registry = new SingleFlightRegistry();
            var invocationCount = 0;
            var gate = new TaskCompletionSource<bool>();

            async Task<int> Factory()
            {
                Interlocked.Increment(ref invocationCount);
                await gate.Task; // hold every concurrent caller here until they've all joined the same in-flight call
                return 99;
            }

            var callers = Enumerable.Range(0, 20)
                .Select(_ => registry.RunOnceAsync("shared-key", Factory))
                .ToArray();

            await Task.Delay(50); // let all 20 callers register against the same in-flight Lazy<Task>
            gate.SetResult(true);
            var results = await Task.WhenAll(callers);

            Assert.Equal(1, invocationCount);
            Assert.All(results, r => Assert.Equal(99, r));
        }

        [Fact]
        public async Task Test13b_DifferentKeys_EachInvokeTheirOwnFactory()
        {
            var registry = new SingleFlightRegistry();
            var calls = new List<string>();

            async Task<string> Factory(string key)
            {
                calls.Add(key);
                await Task.Yield();
                return key;
            }

            var a = await registry.RunOnceAsync("key-a", () => Factory("key-a"));
            var b = await registry.RunOnceAsync("key-b", () => Factory("key-b"));

            Assert.Equal(2, calls.Count);
            Assert.Equal("key-a", a);
            Assert.Equal("key-b", b);
        }
    }
}
